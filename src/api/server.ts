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
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import cors from 'cors';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import type { Orchestrator } from '../orchestrator/index.js';

// ─── SSE Event Bus ───────────────────────────────────────────

interface RunEvent {
  runId: string;
  type: 'status' | 'step' | 'complete' | 'error';
  data: Record<string, unknown>;
  timestamp: string;
}

const runEvents = new EventEmitter();
runEvents.setMaxListeners(100);

export function emitRunEvent(event: RunEvent): void {
  runEvents.emit(`run:${event.runId}`, event);
}

// ─── Rate Limiters ───────────────────────────────────────────

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const pipelineLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many pipeline requests, please try again later.' },
});

// ─── Async Run Store ──────────────────────────────────────────

interface AsyncRun {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  pipelineId: string;
  brandId: string;
  startedAt: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

const asyncRuns = new Map<string, AsyncRun>();
const ASYNC_RUN_RETENTION_MS = 24 * 60 * 60 * 1000;
const ASYNC_RUN_MAX_ENTRIES = 500;

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

function cleanupAsyncRuns(nowTs: number = Date.now()): void {
  for (const run of asyncRuns.values()) {
    if (!isTerminalStatus(run.status)) continue;
    const doneTs = toTimestamp(run.completedAt ?? run.startedAt);
    if (doneTs > 0 && nowTs - doneTs > ASYNC_RUN_RETENTION_MS) {
      asyncRuns.delete(run.id);
    }
  }

  if (asyncRuns.size <= ASYNC_RUN_MAX_ENTRIES) return;

  const terminalRuns = Array.from(asyncRuns.values())
    .filter(run => isTerminalStatus(run.status))
    .sort((a, b) => toTimestamp(a.completedAt ?? a.startedAt) - toTimestamp(b.completedAt ?? b.startedAt));

  for (const run of terminalRuns) {
    if (asyncRuns.size <= ASYNC_RUN_MAX_ENTRIES) break;
    asyncRuns.delete(run.id);
  }
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

function enqueueAsyncRun(
  pipelineId: string,
  brandId: string,
  execute: () => Promise<unknown>,
): AsyncRun {
  cleanupAsyncRuns();

  const asyncRun: AsyncRun = {
    id: generateRunId(),
    status: 'queued',
    pipelineId,
    brandId,
    startedAt: new Date().toISOString(),
  };

  asyncRuns.set(asyncRun.id, asyncRun);

  emitRunEvent({ runId: asyncRun.id, type: 'status', data: { status: 'queued' }, timestamp: asyncRun.startedAt });

  queueMicrotask(() => {
    if (asyncRun.status === 'cancelled') return;
    asyncRun.status = 'running';

    emitRunEvent({ runId: asyncRun.id, type: 'status', data: { status: 'running' }, timestamp: new Date().toISOString() });

    void execute()
      .then(result => {
        if (asyncRun.status === 'cancelled') return;
        asyncRun.status = 'completed';
        asyncRun.completedAt = new Date().toISOString();
        asyncRun.result = result;
        emitRunEvent({ runId: asyncRun.id, type: 'complete', data: { status: 'completed', result }, timestamp: asyncRun.completedAt });
        cleanupAsyncRuns();
      })
      .catch(err => {
        if (asyncRun.status === 'cancelled') return;
        asyncRun.status = 'failed';
        asyncRun.completedAt = new Date().toISOString();
        asyncRun.error = err instanceof Error ? err.message : 'Unknown error';
        emitRunEvent({ runId: asyncRun.id, type: 'error', data: { status: 'failed', error: asyncRun.error }, timestamp: asyncRun.completedAt });
        cleanupAsyncRuns();
      });
  });

  return asyncRun;
}

export function createServer(orchestrator: Orchestrator, port: number = 18789) {
  const app = express();

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  }));

  app.use(express.json({ limit: '50mb' }));

  // Rate limiting
  app.use('/api/', generalLimiter);

  // File upload — use SINT_DATA_DIR for uploads
  const uploadDir = join(process.env.SINT_DATA_DIR ?? './data', 'uploads');
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

  // ─── Health ─────────────────────────────────────────────

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '0.4.0',
      name: 'SINT Marketing Operator',
      skills: orchestrator.listSkills().length,
      brands: orchestrator.listBrands().length,
      pipelines: orchestrator.listPipelines().length,
    });
  });

  // ─── LLM Test ───────────────────────────────────────────

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
      const { brandId, inputs } = req.body;
      if (!brandId) return res.status(400).json({ error: 'brandId required' });
      if (!orchestrator.getPipeline(req.params.id)) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }

      const asyncRun = enqueueAsyncRun(
        req.params.id,
        brandId,
        () => orchestrator.runPipeline(req.params.id, brandId, inputs ?? {}),
      );

      // Return immediately
      res.json({ runId: asyncRun.id, status: asyncRun.status, message: 'Pipeline execution started. Poll GET /api/runs/:id for status.' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // ─── Quick Actions (async) ──────────────────────────────

  app.post('/api/repurpose', pipelineLimiter, async (req, res) => {
    try {
      const { brandId, content, platforms } = req.body;
      const parsedPlatforms = Array.isArray(platforms)
        ? platforms.filter((p: unknown): p is string => typeof p === 'string' && p.trim().length > 0)
        : [];
      if (!brandId || !content || parsedPlatforms.length === 0) {
        return res.status(400).json({ error: 'brandId, content, and platforms required' });
      }

      const asyncRun = enqueueAsyncRun(
        'content-repurpose',
        brandId,
        () => orchestrator.repurposeContent(brandId, content, parsedPlatforms),
      );

      // Return immediately with run ID
      res.json({ runId: asyncRun.id, status: asyncRun.status, message: 'Content repurpose started. Poll GET /api/runs/:id for results.' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  app.post('/api/blog', pipelineLimiter, async (req, res) => {
    try {
      const { brandId, topic, keywords } = req.body;
      if (!brandId || !topic) {
        return res.status(400).json({ error: 'brandId and topic required' });
      }
      const parsedKeywords = Array.isArray(keywords)
        ? keywords.filter((k: unknown): k is string => typeof k === 'string' && k.trim().length > 0)
        : [];

      const asyncRun = enqueueAsyncRun(
        'seo-blog',
        brandId,
        () => orchestrator.generateBlogPost(brandId, topic, parsedKeywords),
      );

      res.json({ runId: asyncRun.id, status: asyncRun.status, message: 'Blog generation started. Poll GET /api/runs/:id for results.' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  app.post('/api/calendar', pipelineLimiter, async (req, res) => {
    try {
      const { brandId, days, themes } = req.body;
      const parsedDays = Number(days);
      if (!brandId || !Number.isFinite(parsedDays) || parsedDays <= 0) {
        return res.status(400).json({ error: 'brandId and days required' });
      }
      const parsedThemes = Array.isArray(themes)
        ? themes.filter((t: unknown): t is string => typeof t === 'string' && t.trim().length > 0)
        : [];

      const asyncRun = enqueueAsyncRun(
        'social-calendar',
        brandId,
        () => orchestrator.generateSocialCalendar(brandId, parsedDays, parsedThemes),
      );

      res.json({ runId: asyncRun.id, status: asyncRun.status, message: 'Calendar generation started. Poll GET /api/runs/:id for results.' });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // ─── Brands ─────────────────────────────────────────────

  app.get('/api/brands', (_req, res) => {
    res.json(orchestrator.listBrands());
  });

  app.get('/api/brands/:id', (req, res) => {
    const brand = orchestrator.getBrand(req.params.id);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });
    res.json(brand);
  });

  app.post('/api/brands', (req, res) => {
    try {
      const brand = orchestrator.createBrand(req.body);
      res.status(201).json(brand);
    } catch (err) {
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
    const existingRun = asyncRuns.get(runId);
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
    cleanupAsyncRuns();

    const wrappedEngineRunIds = new Set<string>();
    for (const run of asyncRuns.values()) {
      if (!isObjectRecord(run.result)) continue;
      if (typeof run.result.id === 'string') {
        wrappedEngineRunIds.add(run.result.id);
      }
    }

    const apiRuns = Array.from(asyncRuns.values()).map(toAsyncRunResponse);
    const engineRuns = orchestrator.listRuns().filter(run => !wrappedEngineRunIds.has(run.id));

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
    cleanupAsyncRuns();

    // Check async runs first
    const asyncRun = asyncRuns.get(req.params.id);
    if (asyncRun) {
      return res.json(toAsyncRunResponse(asyncRun));
    }

    // Check engine runs
    const run = orchestrator.getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  });

  app.post('/api/runs/:id/cancel', (req, res) => {
    cleanupAsyncRuns();

    const run = asyncRuns.get(req.params.id);
    if (!run) return res.status(404).json({ error: 'Run not found or not cancelable' });

    if (isTerminalStatus(run.status)) {
      return res.status(409).json({ error: `Run is already ${run.status}` });
    }

    run.status = 'cancelled';
    run.completedAt = new Date().toISOString();
    run.error = 'Cancelled by user';

    res.json({
      status: 'ok',
      message: 'Cancellation requested. Running task will be ignored when it finishes.',
      run: toAsyncRunResponse(run),
    });
  });

  // ─── Metering ───────────────────────────────────────────

  app.get('/api/usage', (req, res) => {
    const days = parseInt(req.query.days as string) || 30;
    res.json(orchestrator.getUsageSummary(days));
  });

  app.get('/api/usage/current', (_req, res) => {
    res.json(orchestrator.getModelUsage());
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
    join(__dirname, '..', 'ui-static'),              // dist/ui-static (production build)
    join(__dirname, '..', 'ui', 'dist'),             // dist/ui/dist
    join(__dirname, '..', '..', 'src', 'ui', 'dist'), // src/ui/dist (dev)
    join(process.cwd(), 'src', 'ui', 'dist'),        // cwd/src/ui/dist
    join(process.cwd(), 'dist', 'ui-static'),         // cwd/dist/ui-static
  ];

  const uiPath = uiPaths.find(p => existsSync(p)) ?? null;
  console.log(`   UI search: ${uiPaths.map(p => `${existsSync(p) ? '✅' : '❌'} ${p}`).join('\n              ')}`);
  if (uiPath) {
    app.use(express.static(uiPath));
    // SPA fallback — serve index.html for non-API routes
    app.get('*', (req, res) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
        res.sendFile(join(uiPath, 'index.html'));
      }
    });
    console.log('   UI:       http://localhost:' + port + '/');
  }

  // ─── Start ──────────────────────────────────────────────

  const server = app.listen(port, () => {
    console.log(`\n🚀 SINT Marketing Operator API — http://localhost:${port}`);
    console.log(`   Health:    GET  /health`);
    console.log(`   Test LLM:  POST /api/test-llm`);
    console.log(`   Skills:    GET  /api/skills`);
    console.log(`   Usage:     GET  /api/usage`);
    console.log(`   Repurpose: POST /api/repurpose`);
    console.log(`   Blog:      POST /api/blog`);
    console.log(`   Calendar:  POST /api/calendar`);
    console.log(`   Run Poll:  GET  /api/runs/:id`);
    console.log(`   Run Stream: GET  /api/runs/:id/stream (SSE)`);
    console.log(`   Run Cancel: POST /api/runs/:id/cancel\n`);
  });

  return { app, server };
}
