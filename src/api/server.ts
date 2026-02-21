/**
 * REST API Server v3
 *
 * HTTP interface with:
 * - Async pipeline execution (returns run ID immediately)
 * - Proper CORS for Railway deployment
 * - Request timeouts (60s pipeline, 30s other)
 * - LLM connection test endpoint
 * - Run status polling
 * - Metering endpoints
 * - Skill discovery
 * - SSE streaming for run progress
 * - Rate limiting
 */

import express from 'express';
import { join, dirname, resolve } from 'path';
import { ScheduleStore } from '../core/storage/schedule-store.js';
import { RunStore, type AsyncRun } from '../core/storage/run-store.js';
import { WebhookStore } from '../core/storage/webhook-store.js';
import { createHmac, timingSafeEqual } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import cors from 'cors';
import multer from 'multer';
import { ZodError, z } from 'zod';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { nanoid } from 'nanoid';
import type { Orchestrator } from '../orchestrator/index.js';
import { createPublishRoutes } from './publish-routes.js';
import { closePublishQueueStore, initPublishQueueStore, processQueue } from '../services/social/index.js';
import { createMCPRoutes } from '../integrations/mcp-skill-server.js';
import { notifyPipelineComplete, isTelegramConfigured } from '../skills/notifier/telegram.js';
import { createAuthRouter } from '../auth/auth-routes.js';
import { requireAuth, type AuthenticatedRequest } from '../auth/auth-middleware.js';
import { getUser, initAuthDB, verifyToken } from '../auth/auth-service.js';
import { deleteApiKey, getApiKey, hasApiKey, initApiKeyDB, storeApiKey } from '../auth/api-key-service.js';
import { getSocialCredentials, getSocialStatus, initSocialAccountDB, storeSocialCredentials } from '../auth/social-account-service.js';
import { createOnboardingRouter } from './onboarding.js';
import { addNotification, closeNotificationStore, createNotificationsRouter, initNotificationStore } from './notifications.js';
import { createBrand, getBrand, listBrands, saveBrand } from '../core/brand/manager.js';
import type { LinkedInCredentials, TwitterCredentials } from '../services/social/types.js';
import { validateBody } from './validation.js';
import { logger } from './logger.js';

// ─── SSE Event Bus ───────────────────────────────────────────

interface RunEvent {
  runId: string;
  type: 'status' | 'step' | 'complete' | 'error';
  data: Record<string, unknown>;
  timestamp: string;
}

type RequestContext = express.Request & {
  requestId?: string;
  rawBody?: Buffer;
};

const runEvents = new EventEmitter();
runEvents.setMaxListeners(100);

export function emitRunEvent(event: RunEvent): void {
  runEvents.emit(`run:${event.runId}`, event);
}

export function rewriteVersionedPath(url: string): string {
  if (url === '/v1/api' || url.startsWith('/v1/api/') || url.startsWith('/v1/api?')) {
    return url.replace(/^\/v1/, '');
  }
  if (url === '/v1/health' || url.startsWith('/v1/health?')) {
    return url.replace(/^\/v1\/health/, '/health');
  }
  return url;
}

function parseBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }
  return token.trim() || null;
}

function resolveUserIdFromRequest(req: express.Request): string | null {
  const authenticated = (req as AuthenticatedRequest).user?.userId;
  if (authenticated) return authenticated;

  const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
  const token = parseBearerToken(req.header('Authorization')) ?? (queryToken || null);
  if (!token) return null;

  try {
    return verifyToken(token).userId;
  } catch {
    return null;
  }
}

export function getRateLimitKey(req: express.Request): string {
  const userId = resolveUserIdFromRequest(req);
  if (userId) return `user:${userId}`;
  return `ip:${ipKeyGenerator(req.ip ?? '127.0.0.1')}`;
}

export function shouldBypassApiAuth(path: string, authEnabled: boolean, method: string = 'GET'): boolean {
  if (!authEnabled) return true;
  if (path === '/test-llm' || path.startsWith('/auth')) return true;
  if (path.startsWith('/webhooks')) return method.toUpperCase() === 'POST';
  return false;
}

export function resolveRequestId(incoming: string | undefined): string {
  const trimmed = incoming?.trim();
  if (trimmed && trimmed.length > 0 && trimmed.length <= 128) {
    return trimmed;
  }
  return `req_${nanoid(10)}`;
}

export function isValidWebhookSharedSecret(
  expectedSecretRaw: string | undefined,
  providedSecretRaw: string | undefined,
): boolean {
  const expectedSecret = expectedSecretRaw?.trim();
  const providedSecret = providedSecretRaw?.trim();
  return !!expectedSecret && !!providedSecret && expectedSecret === providedSecret;
}

function secureCompareHex(leftHex: string, rightHex: string): boolean {
  try {
    const left = Buffer.from(leftHex, 'hex');
    const right = Buffer.from(rightHex, 'hex');
    if (left.length === 0 || right.length === 0) return false;
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function parseWebhookSignatureCandidates(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(token => token.trim())
    .map(token => {
      const equalsIndex = token.indexOf('=');
      const value = equalsIndex >= 0 ? token.slice(equalsIndex + 1) : token;
      return value.startsWith('sha256=') ? value.slice('sha256='.length) : value;
    })
    .map(value => value.trim())
    .filter(value => value.length > 0 && /^[a-fA-F0-9]+$/.test(value));
}

function parseWebhookTimestamp(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number(raw.trim());
  if (!Number.isFinite(parsed)) return null;
  // Support both seconds and milliseconds input.
  return parsed > 1e11 ? Math.floor(parsed / 1000) : Math.floor(parsed);
}

export function getWebhookHmacToleranceSec(raw: string | undefined): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 300;
  return Math.max(30, Math.min(parsed, 3600));
}

export function isValidWebhookHmacSignature(input: {
  secretRaw: string | undefined;
  signatureHeaderRaw: string | undefined;
  timestampHeaderRaw: string | undefined;
  rawBody: Buffer | undefined;
  toleranceSec?: number;
  nowMs?: number;
}): boolean {
  const secret = input.secretRaw?.trim();
  if (!secret) return false;

  const rawBody = input.rawBody;
  if (!rawBody || rawBody.length === 0) return false;

  const timestamp = parseWebhookTimestamp(input.timestampHeaderRaw);
  if (!timestamp) return false;

  const toleranceSec = input.toleranceSec ?? 300;
  const nowSec = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSec - timestamp) > toleranceSec) return false;

  const candidates = parseWebhookSignatureCandidates(input.signatureHeaderRaw);
  if (candidates.length === 0) return false;

  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest('hex');
  return candidates.some(candidate => secureCompareHex(candidate.toLowerCase(), expected));
}

function getRequestId(req: express.Request): string {
  return (req as RequestContext).requestId ?? 'unknown';
}

// ─── Rate Limiters ───────────────────────────────────────────

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  keyGenerator: (req) => getRateLimitKey(req),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const pipelineLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => getRateLimitKey(req),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many pipeline requests, please try again later.' },
});

// ─── Async Run Store ──────────────────────────────────────────


let runStore: RunStore;
let webhookStore: WebhookStore;
  let scheduleStore: ScheduleStore;
const ASYNC_RUN_RETENTION_MS = 24 * 60 * 60 * 1000;

interface IngestedWebhookEvent {
  id: string;
  userId: string;
  source: string;
  event: string;
  brandId?: string;
  runId?: string;
  data?: Record<string, unknown>;
  receivedAt: string;
}

const MAX_WEBHOOK_EVENTS_PER_USER = 100;

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isTerminalStatus(status: AsyncRun['status']): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

function toTimestamp(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
}

function parseLimitParam(raw: unknown, fallback: number = 100): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 250);
}

function parseStringQuery(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type UsageSummaryResponse = {
  period: string;
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  totalTokens: number;
  totalCostUnits: number;
  byModel: Record<string, { tokens: number; costUnits: number; runs: number }>;
  byPipeline: Record<string, { runs: number; costUnits: number }>;
  byBrand: Record<string, { runs: number; costUnits: number }>;
  byDay: Record<string, { runs: number; tokens: number }>;
};

export function summarizeUsageFromRuns(runs: AsyncRun[], periodDays: number): UsageSummaryResponse {
  const safeDays = Number.isFinite(periodDays) && periodDays > 0 ? periodDays : 30;
  const cutoffTs = Date.now() - (safeDays * 24 * 60 * 60 * 1000);

  const summary: UsageSummaryResponse = {
    period: `${safeDays}d`,
    totalRuns: 0,
    completedRuns: 0,
    failedRuns: 0,
    totalTokens: 0,
    totalCostUnits: 0,
    byModel: {},
    byPipeline: {},
    byBrand: {},
    byDay: {},
  };

  for (const run of runs) {
    const startedTs = Date.parse(run.startedAt);
    if (Number.isFinite(startedTs) && startedTs < cutoffTs) continue;

    summary.totalRuns += 1;
    if (run.status === 'completed') summary.completedRuns += 1;
    if (run.status === 'failed') summary.failedRuns += 1;

    const nested = isObjectRecord(run.result) ? run.result : null;
    const metering = isObjectRecord(nested?.metering) ? nested.metering : null;

    const runTokens = parseNumber(metering?.totalTokens);
    const runCost = parseNumber(metering?.totalCostUnits);
    summary.totalTokens += runTokens;
    summary.totalCostUnits += runCost;

    if (!summary.byPipeline[run.pipelineId]) {
      summary.byPipeline[run.pipelineId] = { runs: 0, costUnits: 0 };
    }
    summary.byPipeline[run.pipelineId].runs += 1;
    summary.byPipeline[run.pipelineId].costUnits += runCost;

    if (!summary.byBrand[run.brandId]) {
      summary.byBrand[run.brandId] = { runs: 0, costUnits: 0 };
    }
    summary.byBrand[run.brandId].runs += 1;
    summary.byBrand[run.brandId].costUnits += runCost;

    // By day
    const day = (run.startedAt || '').slice(0, 10);
    if (day) {
      if (!summary.byDay[day]) summary.byDay[day] = { runs: 0, tokens: 0 };
      summary.byDay[day].runs += 1;
      summary.byDay[day].tokens += runTokens;
    }

    const modelBreakdown = isObjectRecord(metering?.modelBreakdown) ? metering.modelBreakdown : null;
    if (!modelBreakdown) continue;

    for (const [model, row] of Object.entries(modelBreakdown)) {
      if (!isObjectRecord(row)) continue;
      const tokens = parseNumber(row.tokens);
      const costUnits = parseNumber(row.costUnits);
      if (!summary.byModel[model]) {
        summary.byModel[model] = { tokens: 0, costUnits: 0, runs: 0 };
      }
      summary.byModel[model].tokens += tokens;
      summary.byModel[model].costUnits += costUnits;
      summary.byModel[model].runs += 1;
    }
  }

  return summary;
}


function toAsyncRunResponse(run: AsyncRun): Record<string, unknown> {
  const nested = isObjectRecord(run.result) ? run.result : null;
  const response: Record<string, unknown> = {
    id: run.id,
    pipelineId: run.pipelineId || (typeof nested?.pipelineId === 'string' ? nested.pipelineId : 'unknown'),
    brandId: run.brandId || (typeof nested?.brandId === 'string' ? nested.brandId : 'unknown'),
    status: run.status,
    startedAt: run.startedAt || (typeof nested?.startedAt === 'string' ? nested.startedAt : new Date().toISOString()),
    completedAt: run.completedAt ?? (typeof nested?.completedAt === 'string' ? nested.completedAt : undefined),
    error: run.error ?? (typeof nested?.error === 'string' ? nested.error : undefined),
  };

  if (Array.isArray(nested?.outputs)) response.outputs = nested.outputs;
  if (Array.isArray(nested?.steps)) response.steps = nested.steps;
  if (isObjectRecord(nested?.metering)) response.metering = nested.metering;
  if (run.result !== undefined) response.result = run.result;

  return response;
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 7) return '****';
  return `${apiKey.slice(0, 3)}...${apiKey.slice(-4)}`;
}

function getRequestUser(req: express.Request, res: express.Response): { userId: string; email: string } | null {
  const user = (req as AuthenticatedRequest).user;
  if (!user?.userId) {
    // When auth is disabled, use a default user
    if (process.env.AUTH_ENABLED !== 'true') {
      return { userId: 'default', email: 'admin@localhost' };
    }
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return user;
}

/** When auth is disabled, return undefined so brand lookups skip userId filter */
function brandUserId(user: { userId: string }): string | undefined {
  return process.env.AUTH_ENABLED === 'true' ? user.userId : undefined;
}

function resolveWebhookUser(req: express.Request, payloadUserId?: string): { userId: string; email: string } | null {
  const direct = (req as AuthenticatedRequest).user;
  if (direct?.userId) return direct;

  const bearer = parseBearerToken(req.header('Authorization'));
  if (bearer) {
    try {
      return verifyToken(bearer);
    } catch {}
  }

  if (process.env.AUTH_ENABLED !== 'true') {
    return { userId: 'default', email: 'admin@localhost' };
  }

  const hmacSecret = process.env.WEBHOOK_HMAC_SECRET;
  if (hmacSecret?.trim()) {
    const signatureHeader = req.header('x-webhook-signature')
      ?? req.header('x-signature')
      ?? req.header('x-hub-signature-256');
    const timestampHeader = req.header('x-webhook-timestamp')
      ?? req.header('x-timestamp');
    const toleranceSec = getWebhookHmacToleranceSec(process.env.WEBHOOK_HMAC_TOLERANCE_SEC);
    const isValid = isValidWebhookHmacSignature({
      secretRaw: hmacSecret,
      signatureHeaderRaw: signatureHeader,
      timestampHeaderRaw: timestampHeader,
      rawBody: (req as RequestContext).rawBody,
      toleranceSec,
    });
    if (!isValid) {
      return null;
    }
  } else {
    const expectedSecret = process.env.WEBHOOK_INGEST_SECRET;
    const providedSecret = req.header('x-webhook-secret');
    if (!isValidWebhookSharedSecret(expectedSecret, providedSecret)) {
      return null;
    }
  }

  const targetUserId = payloadUserId?.trim() || req.header('x-user-id')?.trim();
  if (!targetUserId) {
    return null;
  }

  const targetUser = getUser(targetUserId);
  if (!targetUser) {
    return null;
  }

  return { userId: targetUser.id, email: targetUser.email };
}

function storeWebhookEvent(event: IngestedWebhookEvent): void {
  webhookStore.save(event);
  webhookStore.trimUserEvents(event.userId, MAX_WEBHOOK_EVENTS_PER_USER);
}

function listWebhookEvents(userId: string, options?: {
  source?: string;
  event?: string;
  limit?: number;
}): IngestedWebhookEvent[] {
  return webhookStore.list({
    userId,
    source: options?.source,
    event: options?.event,
    limit: options?.limit,
  });
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function getPublishWorkerIntervalMs(raw: string | undefined): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30_000;
  return Math.max(5_000, Math.min(parsed, 5 * 60_000));
}

function getPublishWorkerEnabled(raw: string | undefined): boolean {
  return parseBoolean(raw, true);
}

const apiKeySchema = z.object({
  apiKey: z.string().trim().min(1),
});

const twitterCredentialsSchema = z.object({
  apiKey: z.string().trim().min(1),
  apiSecret: z.string().trim().min(1),
  accessToken: z.string().trim().min(1),
  accessSecret: z.string().trim().min(1),
  handle: z.string().trim().min(1).optional(),
});

const linkedInCredentialsSchema = z.object({
  accessToken: z.string().trim().min(1),
  personUrn: z.string().trim().min(1),
});

const webhookPayloadSchema = z.object({
  source: z.string().trim().min(1).max(100).default('external'),
  event: z.string().trim().min(1).max(100),
  runId: z.string().trim().min(1).optional(),
  brandId: z.string().trim().min(1).optional(),
  userId: z.string().trim().min(1).optional(),
  data: z.record(z.unknown()).optional(),
});

const brandSchema = z.object({
  name: z.string().trim().min(1),
  voice: z.object({
    tone: z.array(z.string()),
    style: z.string(),
    doNot: z.array(z.string()),
    vocabulary: z.array(z.string()),
    examples: z.array(z.string()),
  }),
  visual: z.object({
    primaryColors: z.array(z.string()),
    secondaryColors: z.array(z.string()),
    fonts: z.array(z.string()),
    logoUrl: z.string().optional(),
    watermark: z.boolean().optional(),
  }),
  platforms: z.array(z.object({
    platform: z.any(),
    handle: z.string(),
    credentials: z.string().optional(),
    enabled: z.boolean(),
    postingSchedule: z.string().optional(),
  })),
  keywords: z.array(z.string()),
  competitors: z.array(z.string()),
});

function enqueueAsyncRun(
  pipelineId: string,
  brandId: string,
  userId: string,
  execute: () => Promise<unknown>,
): AsyncRun {
  const asyncRun: AsyncRun = {
    id: generateRunId(),
    status: 'queued',
    pipelineId,
    brandId,
    userId,
    startedAt: new Date().toISOString(),
  };

  runStore.save(asyncRun);

  emitRunEvent({ runId: asyncRun.id, type: 'status', data: { status: 'queued' }, timestamp: asyncRun.startedAt });

  queueMicrotask(() => {
    if (asyncRun.status === 'cancelled') return;
    asyncRun.status = 'running';
        runStore.save(asyncRun);

    emitRunEvent({ runId: asyncRun.id, type: 'status', data: { status: 'running' }, timestamp: new Date().toISOString() });

    void execute()
      .then(result => {
        if (asyncRun.status === 'cancelled') return;
        asyncRun.status = 'completed';
        asyncRun.completedAt = new Date().toISOString();
        asyncRun.result = result;
        runStore.save(asyncRun);

        addNotification(asyncRun.userId, {
          type: 'run_completed',
          title: 'Pipeline completed',
          message: `${asyncRun.pipelineId} finished successfully.`,
          runId: asyncRun.id,
        });
        emitRunEvent({ runId: asyncRun.id, type: 'complete', data: { status: 'completed', result }, timestamp: asyncRun.completedAt });

              // Telegram notification
        if (isTelegramConfigured()) {
          void notifyPipelineComplete(
            asyncRun.pipelineId, asyncRun.brandId, asyncRun.id, 'completed',
            { duration: Date.now() - new Date(asyncRun.startedAt).getTime(), costUnits: (result as Record<string, any>)?.metering?.totalCostUnits, tokensUsed: (result as Record<string, any>)?.metering?.totalTokens }
          );
        }
      })
      .catch(err => {
        if (asyncRun.status === 'cancelled') return;
        asyncRun.status = 'failed';
        asyncRun.completedAt = new Date().toISOString();
        asyncRun.error = err instanceof Error ? err.message : 'Unknown error';
        runStore.save(asyncRun);

        addNotification(asyncRun.userId, {
          type: 'run_failed',
          title: 'Pipeline failed',
          message: asyncRun.error,
          runId: asyncRun.id,
        });
        emitRunEvent({ runId: asyncRun.id, type: 'error', data: { status: 'failed', error: asyncRun.error }, timestamp: asyncRun.completedAt });

              // Telegram notification
        if (isTelegramConfigured()) {
          void notifyPipelineComplete(
            asyncRun.pipelineId, asyncRun.brandId, asyncRun.id, 'failed',
            { error: asyncRun.error }
          );
        }
      });
  });

  return asyncRun;
}

export interface CreateServerOptions {
  dataDir?: string;
  configDir?: string;
}

export function createServer(orchestrator: Orchestrator, port: number = 18789, options: CreateServerOptions = {}) {
  const dataDir = resolve(options.dataDir ?? process.env.SINT_DATA_DIR ?? './data');
  const configDir = resolve(options.configDir ?? process.env.SINT_CONFIG_DIR ?? './config');
  const brandsDir = join(configDir, 'brands');
  runStore = new RunStore(join(dataDir, 'runs.db'));
    scheduleStore = new ScheduleStore(join(dataDir, 'schedules.db'));
  webhookStore = new WebhookStore(join(dataDir, 'webhooks.db'));

  const app = express();

  initAuthDB(dataDir);
  initApiKeyDB(dataDir);
  initSocialAccountDB(dataDir);
  initNotificationStore(dataDir);
  initPublishQueueStore(dataDir);

  const publishWorkerEnabled = getPublishWorkerEnabled(process.env.PUBLISH_QUEUE_WORKER_ENABLED);
  const publishWorkerIntervalMs = getPublishWorkerIntervalMs(process.env.PUBLISH_QUEUE_WORKER_INTERVAL_MS);
  let publishWorkerTimer: NodeJS.Timeout | null = null;
  let publishWorkerRunning = false;

  const runPublishQueueWorker = async (): Promise<void> => {
    if (publishWorkerRunning) return;
    publishWorkerRunning = true;
    try {
      const results = await processQueue({
        limit: 50,
        resolveCredentials: (userId) => getSocialCredentials(userId),
        onDeadLetter: async (item, result) => {
          addNotification(item.userId, {
            type: 'warning',
            title: `Publish failed: ${item.request.platform}`,
            message: result.error ?? 'Queued publish failed permanently after retries.',
            runId: item.runId,
          });
        },
      });
      if (results.length > 0) {
        const success = results.filter(result => result.success).length;
        const failed = results.length - success;
        logger.info('Publish worker processed', { processed: results.length, success, failed });
      }
    } catch (error) {
      logger.error('Publish worker processing failed', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      publishWorkerRunning = false;
    }
  };

  app.use((req, _res, next) => {
    const rewritten = rewriteVersionedPath(req.url);
    if (rewritten !== req.url) {
      req.url = rewritten;
    }
    next();
  });

  app.use((req, res, next) => {
    const requestId = resolveRequestId(req.header('x-request-id'));
    (req as RequestContext).requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  // ─── CORS ─────────────────────────────────────────────────
  app.use(cors({
    origin: [
      /localhost/,
      /127\.0\.0\.1/,
      /\.railway\.app$/,
      /\.up\.railway\.app$/,
      /\.vercel\.app$/,
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Webhook-Secret',
      'X-Webhook-Signature',
      'X-Webhook-Timestamp',
      'X-User-Id',
      'X-Request-Id',
    ],
    credentials: true,
  }));

  app.use(express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      (req as RequestContext).rawBody = Buffer.from(buf);
    },
  }));

  app.use('/api', (req, res, next) => {
    const startedAt = Date.now();
    const requestId = getRequestId(req);
    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const userId = (req as AuthenticatedRequest).user?.userId ?? null;
      const payload = {
        event: 'api_request',
        requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs,
        userId,
      };

      if (res.statusCode >= 500) {
        logger.error('API request', payload);
      } else if (res.statusCode >= 400) {
        logger.warn('API request', payload);
      } else {
        logger.info('API request', payload);
      }

      if (durationMs > 5000) {
        logger.warn('Slow request', {
          requestId,
          method: req.method,
          path: req.originalUrl,
          durationMs,
          status: res.statusCode,
          userId,
        });
      }
    });
    next();
  });
  
  // ─── Integrations ────────────────────────────────────────
  app.use("/mcp", createMCPRoutes(orchestrator));

  // Rate limiting
  app.use('/api/', generalLimiter);

  // File upload — use SINT_DATA_DIR for uploads
  const uploadDir = join(dataDir, 'uploads');
  mkdirSync(uploadDir, { recursive: true });
  const upload = multer({ dest: uploadDir, limits: { fileSize: 100 * 1024 * 1024 } });

  // ─── Timeout Middleware ───────────────────────────────────
  // 30s default, pipeline routes get 60s
  app.use((req, res, next) => {
    const isPipelineRoute = req.path.includes('/repurpose')
      || req.path.includes('/blog')
      || req.path.includes('/calendar')
      || (req.path.includes('/pipelines/') && req.method === 'POST');
    const timeout = isPipelineRoute ? 60_000 : 30_000;
    req.setTimeout(timeout);
    res.setTimeout(timeout);
    next();
  });

  // ─── API Docs ────────────────────────────────────────────

  app.get("/api/docs/openapi.yaml", (_req, res) => {
    res.sendFile(join(process.cwd(), "docs", "openapi.yaml"));
  });

  app.get("/api/docs", (_req, res) => {
    res.send(`<!DOCTYPE html>
<html><head><title>SINT API Docs</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: "/api/docs/openapi.yaml", dom_id: "#swagger-ui" })</script>
</body></html>`);
  });

  // ─── Health ─────────────────────────────────────────────

  
  // Export all run results as JSON
  app.get('/api/export', (req, res) => {
    const user = getRequestUser(req, res);
    if (!user) return;
    
    const format = (req.query.format as string) || 'json';
    const runs = runStore.list({ userId: brandUserId(user) ? user.userId : undefined, limit: 1000 });
    const completedRuns = runs.filter(r => r.status === 'completed');
    
    if (format === 'markdown') {
      let md = '# SINT Marketing Operator — Content Export\n\n';
      md += `Generated: ${new Date().toISOString()}\n`;
      md += `Total runs: ${completedRuns.length}\n\n---\n\n`;
      
      for (const run of completedRuns) {
        md += `## ${run.pipelineId} — ${new Date(run.startedAt).toLocaleString()}\n\n`;
        
        const result = typeof run.result === 'string' ? JSON.parse(run.result || '{}') : (run.result || {});
        const steps = result.steps || [];
        
        for (const step of steps) {
          const output = step.output || {};
          
          // Extract deliverables
          if (output.deliverables && Array.isArray(output.deliverables)) {
            for (const d of output.deliverables) {
              md += `### ${(d.platform || 'unknown').toUpperCase()}\n\n`;
              md += `${d.content || ''}\n\n`;
              if (d.hashtags?.length) md += `Tags: ${d.hashtags.join(' ')}\n\n`;
              md += `---\n\n`;
            }
          }
          
          // Extract article
          if (output.article) {
            const a = output.article;
            md += `### ${a.title || 'Article'}\n\n`;
            if (a.metaDescription) md += `*${a.metaDescription}*\n\n`;
            md += `${a.content || ''}\n\n---\n\n`;
          }
          
          // Extract calendar
          if (output.calendar && Array.isArray(output.calendar)) {
            md += `### Content Calendar\n\n`;
            for (const day of output.calendar) {
              md += `#### Day ${day.day || '?'}${day.date ? ' — ' + day.date : ''}\n\n`;
              for (const post of (day.posts || [])) {
                md += `- **${post.platform}** (${post.time || 'TBD'}): ${(post.content || '').slice(0, 100)}...\n`;
              }
              md += '\n';
            }
            md += '---\n\n';
          }
        }
      }
      
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', 'attachment; filename="sint-export.md"');
      res.send(md);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="sint-export.json"');
      res.json({
        exportedAt: new Date().toISOString(),
        totalRuns: completedRuns.length,
        runs: completedRuns.map(r => ({
          id: r.id,
          pipeline: r.pipelineId,
          brand: r.brandId,
          startedAt: r.startedAt,
          result: typeof r.result === 'string' ? JSON.parse(r.result || '{}') : r.result,
        })),
      });
    }
  });


  // ─── Schedules ──────────────────────────────────────────────
  app.get('/api/schedules', (req, res) => {
    const user = getRequestUser(req, res);
    if (!user) return;
    const schedules = scheduleStore.list({ userId: brandUserId(user) ? user.userId : undefined });
    res.json(schedules);
  });

  app.post('/api/schedules', (req, res) => {
    const user = getRequestUser(req, res);
    if (!user) return;
    const { pipelineId, brandId, inputs, nextRunAt, cronExpression } = req.body;
    if (!pipelineId || !brandId || !nextRunAt) {
      return res.status(400).json({ error: 'pipelineId, brandId, and nextRunAt are required' });
    }
    const id = `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const schedule = {
      id, pipelineId, brandId,
      inputs: inputs || {},
      nextRunAt,
      cronExpression: cronExpression || undefined,
      enabled: true,
      userId: user.userId,
      createdAt: new Date().toISOString(),
    };
    scheduleStore.save(schedule);
    res.json(schedule);
  });

  app.delete('/api/schedules/:id', (req, res) => {
    const schedule = scheduleStore.get(req.params.id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
    scheduleStore.delete(req.params.id);
    res.json({ ok: true });
  });

  app.patch('/api/schedules/:id', (req, res) => {
    const schedule = scheduleStore.get(req.params.id);
    if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
    const updated = { ...schedule, ...req.body, id: schedule.id };
    scheduleStore.save(updated);
    res.json(updated);
  });


  // ─── Quick Templates ───────────────────────────────────────
  const QUICK_TEMPLATES = [
    { id: 'product-launch', name: 'Product Launch', description: 'Generate launch posts for all platforms', platforms: ['twitter', 'linkedin', 'instagram'], inputs: ['product_name', 'key_feature', 'launch_date'] },
    { id: 'thought-leadership', name: 'Thought Leadership', description: 'Create thought leadership content from an insight', platforms: ['twitter', 'linkedin'], inputs: ['insight', 'industry'] },
    { id: 'case-study', name: 'Case Study Posts', description: 'Turn a case study into social proof posts', platforms: ['twitter', 'linkedin'], inputs: ['client_name', 'result', 'how'] },
    { id: 'weekly-roundup', name: 'Weekly Roundup', description: 'Create a weekly industry roundup', platforms: ['twitter', 'linkedin', 'email'], inputs: ['industry', 'top_stories'] },
    { id: 'behind-scenes', name: 'Behind the Scenes', description: 'Humanize your brand with BTS content', platforms: ['instagram', 'twitter', 'tiktok'], inputs: ['what_happened', 'team_member'] },
    { id: 'faq-content', name: 'FAQ to Content', description: 'Turn FAQs into engaging social posts', platforms: ['twitter', 'linkedin', 'instagram'], inputs: ['question', 'answer'] },
  ];

  app.get('/api/templates', (_req, res) => {
    res.json(QUICK_TEMPLATES);
  });

  app.post('/api/templates/:id/generate', async (req, res) => {
    const user = getRequestUser(req, res);
    if (!user) return;
    
    const template = QUICK_TEMPLATES.find(t => t.id === req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    
    const { brandId, ...inputs } = req.body;
    if (!brandId) return res.status(400).json({ error: 'brandId is required' });
    
    // Use content-repurpose pipeline with template-specific prompt
    const content = Object.entries(inputs).map(([k, v]) => \`\${k}: \${v}\`).join('\n');
    const runId = enqueueAsyncRun(
      'content-repurpose',
      brandId,
      user,
      \`Template: \${template.name}\n\${content}\`,
      { target_platforms: template.platforms },
      orchestrator
    );
    
    res.json({ runId, template: template.id, status: 'queued' });
  });


  // ─── Analytics ────────────────────────────────────────────
  app.get('/api/analytics', (req, res) => {
    const user = getRequestUser(req, res);
    if (!user) return;
    
    const runs = runStore.list({ userId: brandUserId(user) ? user.userId : undefined, limit: 5000 });
    const completed = runs.filter(r => r.status === 'completed');
    const failed = runs.filter(r => r.status === 'failed');
    
    // Pipeline popularity
    const pipelineCount: Record<string, number> = {};
    for (const r of runs) {
      pipelineCount[r.pipelineId] = (pipelineCount[r.pipelineId] || 0) + 1;
    }
    const topPipelines = Object.entries(pipelineCount)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({ id, count }));
    
    // Success rate
    const successRate = runs.length > 0 ? Math.round((completed.length / runs.length) * 100) : 0;
    
    // Average duration
    const durations = completed
      .filter(r => r.completedAt && r.startedAt)
      .map(r => new Date(r.completedAt!).getTime() - new Date(r.startedAt).getTime());
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    
    // Content volume (count deliverables)
    let totalDeliverables = 0;
    for (const r of completed) {
      try {
        const result = typeof r.result === 'string' ? JSON.parse(r.result || '{}') : (r.result || {});
        const steps = result.steps || [];
        for (const step of steps) {
          const output = step.output || {};
          if (output.deliverables) totalDeliverables += output.deliverables.length;
          if (output.article) totalDeliverables += 1;
          if (output.calendar) totalDeliverables += (output.calendar.length || 0);
        }
      } catch {}
    }
    
    res.json({
      totalRuns: runs.length,
      completedRuns: completed.length,
      failedRuns: failed.length,
      successRate,
      avgDurationMs: avgDuration,
      totalDeliverables,
      topPipelines,
      runsToday: runs.filter(r => r.startedAt?.startsWith(new Date().toISOString().slice(0, 10))).length,
    });
  });


  // ─── Content Variants (A/B Testing) ────────────────────────
  app.post('/api/variants', async (req, res) => {
    const user = getRequestUser(req, res);
    if (!user) return;
    
    const { brandId, content, platform, count } = req.body;
    if (!brandId || !content || !platform) {
      return res.status(400).json({ error: 'brandId, content, and platform are required' });
    }
    
    const variantCount = Math.min(count || 3, 5);
    const brand = getBrand(brandId, brandUserId(user));
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    
    try {
      const result = await orchestrator.llm.completeJSON<{ variants: Array<{ content: string; hook: string; angle: string; tone: string }> }>(
        \`Generate \${variantCount} distinctly different versions of this content for \${platform}.

Brand: \${brand.name}
Voice: \${JSON.stringify(brand.voice || {})}

Source content: \${content.slice(0, 5000)}

Each variant must use a COMPLETELY different:
- Hook (opening line)
- Angle (perspective/approach)  
- Tone (within brand guidelines)

Platform: \${platform}
\${platform === 'twitter' ? 'Max 280 chars per variant.' : ''}
\${platform === 'linkedin' ? 'Max 3000 chars per variant.' : ''}

Respond with JSON: { "variants": [{ "content": "full post text", "hook": "the hook used", "angle": "the angle", "tone": "tone description" }] }\`,
        { type: 'object' },
        { tier: 'complex', maxTokens: 4096 }
      );
      
      res.json({
        platform,
        brand: brand.name,
        variants: result.data.variants || [],
        tokensUsed: result.meta.totalTokens,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to generate variants' });
    }
  });

app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: process.env.npm_package_version || '0.5.0',
      name: 'SINT Marketing Operator',
      skills: orchestrator.listSkills().length,
      brands: orchestrator.listBrands().length,
      pipelines: orchestrator.listPipelines().length,
    });
  });

  // ─── Public API Endpoints ───────────────────────────────

  app.post('/api/test-llm', async (_req, res) => {
    try {
      const result = await orchestrator.testLLM();
      res.json(result);
    } catch (err) {
      res.status(500).json({
        ok: false,
        mode: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  app.use('/api/auth', createAuthRouter());

  // Protect all /api routes (only when AUTH_ENABLED=true)
  app.use('/api', (req, res, next) => {
    if (shouldBypassApiAuth(req.path, process.env.AUTH_ENABLED === 'true', req.method)) {
      next();
      return;
    }
    requireAuth(req, res, next);
  });

  // ─── Onboarding / Settings / Notifications ───────────────

  app.use("/api/publish", createPublishRoutes());
  app.use('/api/onboarding', createOnboardingRouter({ brandsDir }));
  app.use('/api/notifications', createNotificationsRouter());

  app.post('/api/webhooks', (req, res) => {
    const requestId = getRequestId(req);
    try {
      const payload = webhookPayloadSchema.parse(req.body ?? {});
      const user = resolveWebhookUser(req, payload.userId);
      if (!user) {
        console.warn(JSON.stringify({
          level: 'warn',
          event: 'webhook_unauthorized',
          requestId,
          source: payload.source,
          webhookEvent: payload.event,
        }));
        res.status(401).json({ error: 'Unauthorized webhook request', requestId });
        return;
      }

      const event: IngestedWebhookEvent = {
        id: nanoid(12),
        userId: user.userId,
        source: payload.source,
        event: payload.event,
        brandId: payload.brandId,
        runId: payload.runId,
        data: payload.data,
        receivedAt: new Date().toISOString(),
      };

      storeWebhookEvent(event);
      console.log(JSON.stringify({
        level: 'info',
        event: 'webhook_ingested',
        requestId,
        source: event.source,
        webhookEvent: event.event,
        userId: event.userId,
        runId: event.runId ?? null,
      }));
      addNotification(user.userId, {
        type: 'info',
        title: `Webhook: ${payload.event}`,
        message: `${payload.source} webhook received`,
        runId: payload.runId,
      });

      res.status(202).json({
        success: true,
        id: event.id,
        receivedAt: event.receivedAt,
        requestId,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: error.issues[0]?.message ?? 'Invalid webhook payload', requestId });
        return;
      }
      console.error(JSON.stringify({
        level: 'error',
        event: 'webhook_ingest_failed',
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error', requestId });
    }
  });

  app.get('/api/webhooks', (req, res) => {
    const user = getRequestUser(req, res);
    if (!user) return;

    const items = listWebhookEvents(user.userId, {
      source: parseStringQuery(req.query.source),
      event: parseStringQuery(req.query.event),
      limit: parseLimitParam(req.query.limit, 50),
    });
    res.json({
      items,
      total: items.length,
    });
  });

  app.post('/api/settings/api-key', (req, res) => {
    try {
      const user = getRequestUser(req, res);
      if (!user) return;

      const payload = apiKeySchema.parse(req.body ?? {});
      storeApiKey(user.userId, payload.apiKey);
      // Also set as env var for LLM router
      process.env.OPENAI_API_KEY = payload.apiKey;
      // Hot-reload: reinitialize LLM router with new key
      orchestrator.updateApiKeys(payload.apiKey, undefined);
      res.json({ success: true, masked: maskApiKey(payload.apiKey) });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: error.issues[0]?.message ?? 'Invalid payload' });
        return;
      }
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/settings/api-key', (req, res) => {
    try {
      const user = getRequestUser(req, res);
      if (!user) return;

      if (!hasApiKey(user.userId)) {
        // Check env var as fallback
        if (process.env.OPENAI_API_KEY) {
          res.json({ hasKey: true, masked: maskApiKey(process.env.OPENAI_API_KEY) });
          return;
        }
        res.json({ hasKey: false, masked: null });
        return;
      }

      const apiKey = getApiKey(user.userId);
      if (!apiKey) {
        res.json({ hasKey: false, masked: null });
        return;
      }

      res.json({ hasKey: true, masked: maskApiKey(apiKey) });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.delete('/api/settings/api-key', (req, res) => {
    try {
      const user = getRequestUser(req, res);
      if (!user) return;

      deleteApiKey(user.userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // ─── Anthropic Key Management ─────────────────────────────

  app.post('/api/settings/anthropic-key', (req, res) => {
    try {
      const user = getRequestUser(req, res);
      if (!user) return;

      const payload = apiKeySchema.parse(req.body ?? {});
      storeApiKey(user.userId + ':anthropic', payload.apiKey);
      // Also set as env var for LLM router
      process.env.ANTHROPIC_API_KEY = payload.apiKey;
      // Hot-reload: reinitialize LLM router with new key
      orchestrator.updateApiKeys(undefined, payload.apiKey);
      res.json({ success: true, masked: maskApiKey(payload.apiKey) });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: error.issues[0]?.message ?? 'Invalid payload' });
        return;
      }
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/settings/anthropic-key', (req, res) => {
    try {
      const user = getRequestUser(req, res);
      if (!user) return;

      if (!hasApiKey(user.userId + ':anthropic')) {
        // Check env var as fallback
        if (process.env.ANTHROPIC_API_KEY) {
          res.json({ hasKey: true, masked: maskApiKey(process.env.ANTHROPIC_API_KEY) });
          return;
        }
        res.json({ hasKey: false, masked: null });
        return;
      }

      const apiKey = getApiKey(user.userId + ':anthropic');
      if (!apiKey) {
        res.json({ hasKey: false, masked: null });
        return;
      }

      res.json({ hasKey: true, masked: maskApiKey(apiKey) });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });


  // ─── Social Account Connection ──────────────────────────

  app.post('/api/settings/social/:platform', (req, res) => {
    try {
      const user = getRequestUser(req, res);
      if (!user) return;

      const { platform } = req.params;
      if (platform === 'twitter') {
        const payload = twitterCredentialsSchema.parse(req.body ?? {});
        const credentials: TwitterCredentials = {
          apiKey: payload.apiKey,
          apiSecret: payload.apiSecret,
          accessToken: payload.accessToken,
          accessSecret: payload.accessSecret,
          ...(payload.handle ? { handle: payload.handle } : {}),
        };
        storeSocialCredentials(user.userId, 'twitter', credentials);
        res.json({ ok: true, platform });
        return;
      }

      if (platform === 'linkedin') {
        const payload = linkedInCredentialsSchema.parse(req.body ?? {});
        const credentials: LinkedInCredentials = {
          accessToken: payload.accessToken,
          personUrn: payload.personUrn,
        };
        storeSocialCredentials(user.userId, 'linkedin', credentials);
        res.json({ ok: true, platform });
        return;
      }

      res.status(400).json({ error: `Unsupported platform: ${platform}` });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: error.issues[0]?.message ?? 'Invalid payload' });
        return;
      }
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/settings/social/status', (req, res) => {
    const user = getRequestUser(req, res);
    if (!user) return;

    const status = getSocialStatus(user.userId);

    // Backward compatibility for local single-user mode using env vars.
    if (process.env.AUTH_ENABLED !== 'true') {
      status.twitter.configured = status.twitter.configured || !!(
        process.env.TWITTER_API_KEY
        && process.env.TWITTER_API_SECRET
        && process.env.TWITTER_ACCESS_TOKEN
        && process.env.TWITTER_ACCESS_SECRET
      );
      if (!status.twitter.handle && process.env.TWITTER_HANDLE) {
        status.twitter.handle = process.env.TWITTER_HANDLE;
      }
      status.linkedin.configured = status.linkedin.configured || !!(
        process.env.LINKEDIN_ACCESS_TOKEN
        && process.env.LINKEDIN_PERSON_URN
      );
      if (!status.linkedin.personUrn && process.env.LINKEDIN_PERSON_URN) {
        status.linkedin.personUrn = process.env.LINKEDIN_PERSON_URN;
      }
    }

    res.json(status);
  });

  // ─── Pipelines ──────────────────────────────────────────

  app.get('/api/pipelines', (_req, res) => {
    res.json(orchestrator.listPipelines());
  });

  app.get('/api/pipelines/:id', (req, res) => {
    const pipeline = orchestrator.getPipeline(req.params.id);
    if (!pipeline) return res.status(404).json({ error: 'Pipeline not found' });
    res.json(pipeline);
  });

  app.post('/api/pipelines/:id/run', pipelineLimiter, async (req, res) => {
    try {
      const user = getRequestUser(req, res);
      if (!user) return;

      const { brandId, inputs } = req.body;
      if (!brandId) return res.status(400).json({ error: 'brandId required' });
      if (!orchestrator.getPipeline(req.params.id)) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }
      if (!getBrand(brandId, brandUserId(user))) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      const asyncRun = enqueueAsyncRun(
        req.params.id,
        brandId,
        user.userId,
        () => orchestrator.runPipeline(req.params.id, brandId, inputs ?? {}),
      );

      // Return immediately
      res.json({ runId: asyncRun.id, status: asyncRun.status, message: 'Pipeline execution started. Poll GET /api/runs/:id for status.' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // ─── Quick Actions (async) ──────────────────────────────

  app.post('/api/repurpose', pipelineLimiter, validateBody({
    content: { type: 'string', required: true, maxLength: 50000 },
    brandId: { type: 'string', required: true },
    platforms: { type: 'array', required: true },
  }), async (req, res) => {
    try {
      const user = getRequestUser(req, res);
      if (!user) return;

      const { brandId, content, platforms } = req.body;
      const parsedPlatforms = Array.isArray(platforms)
        ? platforms.filter((p: unknown): p is string => typeof p === 'string' && p.trim().length > 0)
        : [];
      if (!brandId || !content || parsedPlatforms.length === 0) {
        return res.status(400).json({ error: 'brandId, content, and platforms required' });
      }
      if (!getBrand(brandId, brandUserId(user))) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      const asyncRun = enqueueAsyncRun(
        'content-repurpose',
        brandId,
        user.userId,
        () => orchestrator.repurposeContent(brandId, content, parsedPlatforms),
      );

      // Return immediately with run ID
      res.json({ runId: asyncRun.id, status: asyncRun.status, message: 'Content repurpose started. Poll GET /api/runs/:id for results.' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  app.post('/api/blog', pipelineLimiter, validateBody({
    topic: { type: 'string', required: true, maxLength: 1000 },
    brandId: { type: 'string', required: true },
  }), async (req, res) => {
    try {
      const user = getRequestUser(req, res);
      if (!user) return;

      const { brandId, topic, keywords } = req.body;
      if (!brandId || !topic) {
        return res.status(400).json({ error: 'brandId and topic required' });
      }
      if (!getBrand(brandId, brandUserId(user))) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      const parsedKeywords = Array.isArray(keywords)
        ? keywords.filter((k: unknown): k is string => typeof k === 'string' && k.trim().length > 0)
        : [];

      const asyncRun = enqueueAsyncRun(
        'seo-blog',
        brandId,
        user.userId,
        () => orchestrator.generateBlogPost(brandId, topic, parsedKeywords),
      );

      res.json({ runId: asyncRun.id, status: asyncRun.status, message: 'Blog generation started. Poll GET /api/runs/:id for results.' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  app.post('/api/calendar', pipelineLimiter, validateBody({
    brandId: { type: 'string', required: true },
    days: { type: 'number', required: true },
  }), async (req, res) => {
    try {
      const user = getRequestUser(req, res);
      if (!user) return;

      const { brandId, days, themes } = req.body;
      const parsedDays = Number(days);
      if (!brandId || !Number.isFinite(parsedDays) || parsedDays <= 0) {
        return res.status(400).json({ error: 'brandId and days required' });
      }
      if (!getBrand(brandId, brandUserId(user))) {
        return res.status(404).json({ error: 'Brand not found' });
      }

      const parsedThemes = Array.isArray(themes)
        ? themes.filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0)
        : [];

      const asyncRun = enqueueAsyncRun(
        'social-calendar',
        brandId,
        user.userId,
        () => orchestrator.generateSocialCalendar(brandId, parsedDays, parsedThemes),
      );

      res.json({ runId: asyncRun.id, status: asyncRun.status, message: 'Calendar generation started. Poll GET /api/runs/:id for results.' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // ─── Brands ─────────────────────────────────────────────

  app.get('/api/brands', (req, res) => {
    const user = getRequestUser(req, res);
    if (!user) return;

    // When auth disabled, show all brands (including templates)
    const userId = process.env.AUTH_ENABLED === 'true' ? user.userId : undefined;
    res.json(listBrands(userId));
  });

  app.get('/api/brands/:id', (req, res) => {
    const user = getRequestUser(req, res);
    if (!user) return;

    const userId = process.env.AUTH_ENABLED === 'true' ? user.userId : undefined;
    const brand = getBrand(req.params.id, userId);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    res.json(brand);
  });

  app.post('/api/brands', (req, res) => {
    try {
      const user = getRequestUser(req, res);
      if (!user) return;

      const payload = brandSchema.parse(req.body ?? {});
      const brand = createBrand(user.userId, {
        name: payload.name,
        voice: payload.voice,
        visual: payload.visual,
        platforms: payload.platforms as any,
        keywords: payload.keywords,
        competitors: payload.competitors,
      });

      saveBrand(brand, brandsDir);
      res.status(201).json(brand);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid payload' });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // ─── Assets ─────────────────────────────────────────────

  app.get('/api/assets', (_req, res) => {
    res.json(orchestrator.listAssets());
  });

  app.post('/api/assets/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const asset = await orchestrator.uploadAsset(req.file.path, req.file.originalname);
      res.status(201).json(asset);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // ─── Skills ─────────────────────────────────────────────

  app.get('/api/skills', (_req, res) => {
    res.json(orchestrator.listSkills());
  });

  // ─── SSE Run Streaming ──────────────────────────────────

  app.get('/api/runs/:id/stream', (req, res) => {
    const runId = req.params.id;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write(`data: ${JSON.stringify({ type: 'connected', runId })}\n\n`);

    const listener = (event: RunEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.type === 'complete' || event.type === 'error') {
        cleanup();
        res.end();
      }
    };

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      runEvents.removeListener(`run:${runId}`, listener);
    };

    runEvents.on(`run:${runId}`, listener);
    req.on('close', cleanup);

    // If run is already terminal, send final event immediately
    const existingRun = runStore.get(runId);
    if (existingRun && isTerminalStatus(existingRun.status)) {
      const eventType = existingRun.status === 'completed' ? 'complete' : 'error';
      res.write(`data: ${JSON.stringify({
        runId,
        type: eventType,
        data: { status: existingRun.status, result: existingRun.result, error: existingRun.error },
        timestamp: existingRun.completedAt ?? new Date().toISOString(),
      })}\n\n`);
      cleanup();
      res.end();
    }
  });

  // ─── Runs (both engine runs and async API runs) ─────────

  app.get('/api/runs', (req, res) => {
    const user = getRequestUser(req, res);
    if (!user) return;

      const userAsyncRuns = runStore.list({ userId: user.userId });

    const wrappedEngineRunIds = new Set<string>();
    for (const run of userAsyncRuns) {
      if (!isObjectRecord(run.result)) continue;
      if (typeof run.result.id === 'string') {
        wrappedEngineRunIds.add(run.result.id);
      }
    }

    const apiRuns = userAsyncRuns.map(toAsyncRunResponse);
    const engineRuns = orchestrator.listRuns().filter(run => {
      if (wrappedEngineRunIds.has(run.id)) return false;
      return !!getBrand(run.brandId, brandUserId(user));
    });

    const statusFilter = parseStringQuery(req.query.status)?.toLowerCase();
    const pipelineFilter = parseStringQuery(req.query.pipelineId)?.toLowerCase();
    const brandFilter = parseStringQuery(req.query.brandId)?.toLowerCase();

    const combined = [...apiRuns, ...engineRuns]
      .filter(run => {
        const runStatus = String((run as { status?: unknown }).status ?? '').toLowerCase();
        const runPipelineId = String((run as { pipelineId?: unknown }).pipelineId ?? '').toLowerCase();
        const runBrandId = String((run as { brandId?: unknown }).brandId ?? '').toLowerCase();

        if (statusFilter && runStatus !== statusFilter) return false;
        if (pipelineFilter && !runPipelineId.includes(pipelineFilter)) return false;
        if (brandFilter && !runBrandId.includes(brandFilter)) return false;
        return true;
      })
      .sort((a, b) => toTimestamp(b.startedAt) - toTimestamp(a.startedAt));

    const limit = parseLimitParam(req.query.limit, 100);
    res.json(combined.slice(0, limit));
  });

  app.get('/api/runs/:id', (req, res) => {
    const user = getRequestUser(req, res);
    if (!user) return;

      // Check async runs first
    const asyncRun = runStore.get(req.params.id);
    if (asyncRun && asyncRun.userId === user.userId) {
      return res.json(toAsyncRunResponse(asyncRun));
    }

    // Check engine runs
    const run = orchestrator.getRun(req.params.id);
    if (!run || !getBrand(run.brandId, brandUserId(user))) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json(run);
  });

  app.post('/api/runs/:id/cancel', (req, res) => {
    const user = getRequestUser(req, res);
    if (!user) return;

      const run = runStore.get(req.params.id);
    if (!run || run.userId !== user.userId) {
      return res.status(404).json({ error: 'Run not found or not cancelable' });
    }

    if (isTerminalStatus(run.status)) {
      return res.status(409).json({ error: `Run is already ${run.status}` });
    }

    run.status = 'cancelled';
    run.completedAt = new Date().toISOString();
    run.error = 'Cancelled by user';
    runStore.save(run);

    res.json({
      status: 'ok',
      message: 'Cancellation requested. Running task will be ignored when it finishes.',
      run: toAsyncRunResponse(run),
    });
  });

  // ─── Metering ───────────────────────────────────────────


  app.delete('/api/runs/:id', (req, res) => {
    const { id } = req.params;
    const run = runStore.get(id);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    runStore.delete(id);
    res.json({ ok: true });
  });


  // Retry a failed/completed run with same parameters
  app.post('/api/runs/:id/retry', async (req, res) => {
    const { id } = req.params;
    const original = runStore.get(id);
    if (!original) return res.status(404).json({ error: 'Run not found' });
    
    try {
      // Re-run the same pipeline with same brand
      const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newRun = {
        id: runId,
        status: 'queued' as const,
        pipelineId: original.pipelineId,
        brandId: original.brandId,
        userId: original.userId,
        startedAt: new Date().toISOString(),
      };
      runStore.save(newRun);
      
      // Start the pipeline (fire and forget)
      const orchestrator = req.app.get('orchestrator');
      if (orchestrator) {
        orchestrator.runPipeline(original.pipelineId, original.brandId, {})
          .then((result: any) => {
            runStore.save({ ...newRun, status: 'completed', completedAt: new Date().toISOString(), result });
          })
          .catch((err: any) => {
            runStore.save({ ...newRun, status: 'failed', completedAt: new Date().toISOString(), error: err.message });
          });
      }
      
      res.json({ runId, status: 'queued', message: 'Retry started' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Retry failed' });
    }
  });

  app.get('/api/usage', (req, res) => {
    const user = getRequestUser(req, res);
    if (!user) return;

    const daysRaw = Number.parseInt(String(req.query.days ?? ''), 10);
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? daysRaw : 30;
    const runs = runStore.list({ userId: user.userId, limit: 5000 });
    const runSummary = summarizeUsageFromRuns(runs, days);

    // Also get metering tracker data if available (has per-step granularity)
    try {
      const meterSummary = orchestrator.getUsageSummary(days);
      // Merge: use whichever source has more data
      if (meterSummary.totalTokens > runSummary.totalTokens) {
        runSummary.totalTokens = meterSummary.totalTokens;
        runSummary.totalCostUnits = meterSummary.totalCostUnits;
      }
      // Merge model breakdown from metering (more granular)
      if (Object.keys(meterSummary.byModel).length > Object.keys(runSummary.byModel).length) {
        runSummary.byModel = meterSummary.byModel;
      }
    } catch { /* metering tracker may not be available */ }

    res.json(runSummary);
  });

  app.get('/api/usage/current', (req, res) => {
    const user = getRequestUser(req, res);
    if (!user) return;

    const summary = summarizeUsageFromRuns(runStore.list({ userId: user.userId, limit: 500 }), 1);

    // Merge metering tracker data for today
    try {
      const meterSummary = orchestrator.getUsageSummary(1);
      if (meterSummary.totalTokens > summary.totalTokens) {
        summary.totalTokens = meterSummary.totalTokens;
        summary.totalCostUnits = meterSummary.totalCostUnits;
      }
      if (Object.keys(meterSummary.byModel).length > Object.keys(summary.byModel).length) {
        summary.byModel = meterSummary.byModel;
      }
    } catch { /* metering tracker may not be available */ }

    res.json({
      totalRuns: summary.totalRuns,
      totalTokens: summary.totalTokens,
      totalCostUnits: summary.totalCostUnits,
      byModel: summary.byModel,
      period: summary.period,
    });
  });

  app.post('/api/usage/limits', (req, res) => {
    try {
      orchestrator.setUsageLimits(req.body);
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // ─── Serve UI ────────────────────────────────────────

  // Serve built UI from src/ui/dist/
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const uiPaths = [
    join(__dirname, '..', 'ui-static'),                // dist/ui-static (production build)
    join(__dirname, '..', 'ui', 'dist'),               // dist/ui/dist
    join(__dirname, '..', '..', 'src', 'ui', 'dist'),  // src/ui/dist (dev)
    join(process.cwd(), 'src', 'ui', 'dist'),          // cwd/src/ui/dist
    join(process.cwd(), 'dist', 'ui-static'),          // cwd/dist/ui-static
  ];

  const uiPath = uiPaths.find(p => existsSync(join(p, 'index.html'))) ?? null;
  console.log(`   UI search: ${uiPaths.map(p => `${existsSync(p) ? '✅' : '❌'} ${p}`).join('\n              ')}`);
  if (uiPath) {
    app.use(express.static(uiPath));
    // SPA fallback — serve index.html for non-API routes
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
        const indexFile = join(uiPath, 'index.html');
        if (existsSync(indexFile)) {
          res.sendFile(indexFile);
        } else {
          res.status(200).send('<html><body><h1>SINT Operator</h1><p>API is running. UI build pending.</p><p><a href="/health">/health</a> | <a href="/api/docs">/api/docs</a></p></body></html>');
        }
      }
    });
    console.log('   UI:       http://localhost:' + port + '/');
  }

  // ─── Background Publish Worker ─────────────────────────

  if (publishWorkerEnabled) {
    publishWorkerTimer = setInterval(() => {
      void runPublishQueueWorker();
    }, publishWorkerIntervalMs);
    if (typeof publishWorkerTimer.unref === 'function') {
      publishWorkerTimer.unref();
    }
    void runPublishQueueWorker();
  }

  // ─── Start ──────────────────────────────────────────────

  const server = app.listen(port, '0.0.0.0', () => {
    logger.info('SINT Marketing Operator API started', { port, url: `http://0.0.0.0:${port}` });
    logger.info('Routes registered', { publishWorker: publishWorkerEnabled, publishWorkerIntervalMs });
  });

  server.on('close', () => {
    if (publishWorkerTimer) {
      clearInterval(publishWorkerTimer);
      publishWorkerTimer = null;
    }
    closePublishQueueStore();
    closeNotificationStore();
    runStore.close();
    webhookStore.close();
  });

  
    // Schedule runner — check every 60 seconds
    setInterval(() => {
      try {
        const due = scheduleStore.getDue();
        for (const sched of due) {
          console.log(`[Scheduler] Running: ${sched.pipelineId}`);
          const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          runStore.save({
            id: runId, status: 'queued', pipelineId: sched.pipelineId,
            brandId: sched.brandId, userId: sched.userId, startedAt: new Date().toISOString(),
          });
          
          orchestrator.runPipeline(sched.pipelineId, sched.brandId, sched.inputs || {})
            .then((result) => {
              runStore.save({ id: runId, status: 'completed', pipelineId: sched.pipelineId,
                brandId: sched.brandId, userId: sched.userId, startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(), result });
            })
            .catch((err) => {
              runStore.save({ id: runId, status: 'failed', pipelineId: sched.pipelineId,
                brandId: sched.brandId, userId: sched.userId, startedAt: new Date().toISOString(),
                completedAt: new Date().toISOString(), error: err.message });
            });
          
          // Update schedule
          scheduleStore.save({
            ...sched,
            lastRunAt: new Date().toISOString(),
            enabled: !!sched.cronExpression,
            nextRunAt: sched.cronExpression
              ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Simple: +1 day
              : sched.nextRunAt,
          });
        }
      } catch (err) {
        console.error('[Scheduler] Error:', err);
      }
    }, 60_000);

    return { app, server };
}
