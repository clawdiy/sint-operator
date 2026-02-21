/**
 * Social Publishing Manager
 *
 * Unified interface for publishing content to social platforms.
 * Handles: Twitter/X, LinkedIn (more to come: Instagram, Telegram, Discord)
 */

import { join, resolve } from 'path';
import { postTweet, postThread, isTwitterConfigured, type TweetResult, type ThreadResult } from './twitter.js';
import { postLinkedInUpdate, postLinkedInArticle, isLinkedInConfigured, verifyLinkedInToken, type LinkedInPostResult } from './linkedin.js';
import { PublishQueueStore, type PersistedPublishQueueItem, type PublishQueueStatus } from '../../core/storage/publish-queue-store.js';
import type { Platform, Logger } from '../../core/types.js';
import type { SocialCredentials } from './types.js';

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000];

// ─── Types ────────────────────────────────────────────────────

export interface PublishRequest {
  platform: Platform;
  content: string;
  hashtags?: string[];
  media?: string[];
  articleUrl?: string;
  articleTitle?: string;
  articleDescription?: string;
  isThread?: boolean;  // For Twitter threads
}

export interface PublishResult {
  platform: Platform;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface PublishQueueItem {
  id: string;
  userId: string;
  request: PublishRequest;
  brandId: string;
  runId?: string;
  scheduledAt?: string;
  status: PublishQueueStatus;
  result?: PublishResult;
  attemptCount: number;
  nextAttemptAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublishContext {
  userId?: string;
  credentials?: SocialCredentials;
}

export interface ProcessQueueOptions {
  userId?: string;
  logger?: Logger;
  limit?: number;
  now?: Date;
  resolveCredentials?: (userId: string) => SocialCredentials | Promise<SocialCredentials>;
}

let queueStore: PublishQueueStore | null = null;
const publishQueueMemory: PublishQueueItem[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

function makeQueueId(): string {
  return `pub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePublishRequest(value: unknown): PublishRequest {
  if (!value || typeof value !== 'object') {
    return { platform: 'twitter', content: '' } as PublishRequest;
  }
  return value as PublishRequest;
}

function normalizePublishResult(value: unknown): PublishResult | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const maybe = value as Record<string, unknown>;
  if (typeof maybe.platform !== 'string' || typeof maybe.success !== 'boolean') return undefined;
  return maybe as unknown as PublishResult;
}

function toQueueItem(record: PersistedPublishQueueItem): PublishQueueItem {
  return {
    id: record.id,
    userId: record.userId,
    request: normalizePublishRequest(record.request),
    brandId: record.brandId,
    runId: record.runId,
    scheduledAt: record.scheduledAt,
    status: record.status,
    result: normalizePublishResult(record.result),
    attemptCount: record.attemptCount,
    nextAttemptAt: record.nextAttemptAt,
    lastError: record.lastError,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toPersistedRecord(item: PublishQueueItem): PersistedPublishQueueItem {
  return {
    id: item.id,
    userId: item.userId,
    request: item.request as unknown as Record<string, unknown>,
    brandId: item.brandId,
    runId: item.runId,
    scheduledAt: item.scheduledAt,
    status: item.status,
    result: item.result as unknown as Record<string, unknown> | undefined,
    attemptCount: item.attemptCount,
    nextAttemptAt: item.nextAttemptAt,
    lastError: item.lastError,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function saveQueueItem(item: PublishQueueItem): void {
  if (queueStore) {
    queueStore.save(toPersistedRecord(item));
    return;
  }

  const idx = publishQueueMemory.findIndex(existing => existing.id === item.id);
  if (idx >= 0) {
    publishQueueMemory[idx] = item;
  } else {
    publishQueueMemory.push(item);
  }
}

function getRetryDelayMs(attemptCount: number): number {
  const idx = Math.min(Math.max(attemptCount - 1, 0), RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[idx];
}

export function initPublishQueueStore(dataDir: string): void {
  const dbPath = join(resolve(dataDir), 'publish-queue.db');
  if (!queueStore) {
    queueStore = new PublishQueueStore(dbPath);
  }
}

// ─── Publishing ───────────────────────────────────────────────

/**
 * Publish content to a single platform.
 */
export async function publish(
  request: PublishRequest,
  logger?: Logger,
  context: PublishContext = {},
): Promise<PublishResult> {
  const { platform, content, hashtags, articleUrl, articleTitle, articleDescription, isThread } = request;
  const credentials = context.credentials;

  // Append hashtags to content if present
  const fullContent = hashtags && hashtags.length > 0
    ? `${content}\n\n${hashtags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ')}`
    : content;

  switch (platform) {
    case 'twitter': {
      if (!isTwitterConfigured(credentials?.twitter)) {
        return { platform, success: false, error: 'Twitter credentials not configured for this user.' };
      }

      if (isThread) {
        // Split content by /1, /2 markers or double newlines
        const parts = fullContent.includes('/1')
          ? fullContent.split(/\/\d+\s*\n?/).filter(Boolean).map(s => s.trim())
          : fullContent.split(/\n\n+/).filter(s => s.trim().length > 0);

        const threadResult = await postThread(parts, logger, credentials?.twitter);
        if (threadResult && threadResult.tweets.length > 0) {
          return {
            platform,
            success: true,
            postId: threadResult.tweets[0].id,
            postUrl: threadResult.threadUrl,
          };
        }
        return { platform, success: false, error: 'Thread posting failed' };
      }

      // Single tweet — truncate if over 280
      const tweetText = fullContent.length > 280 ? fullContent.slice(0, 277) + '...' : fullContent;
      const tweetResult = await postTweet(tweetText, logger, undefined, credentials?.twitter);
      if (tweetResult) {
        return { platform, success: true, postId: tweetResult.id, postUrl: tweetResult.url };
      }
      return { platform, success: false, error: 'Tweet posting failed' };
    }

    case 'linkedin': {
      if (!isLinkedInConfigured(credentials?.linkedin)) {
        return { platform, success: false, error: 'LinkedIn credentials not configured for this user.' };
      }

      let result: LinkedInPostResult | null;
      if (articleUrl && articleTitle) {
        result = await postLinkedInArticle(
          fullContent,
          articleUrl,
          articleTitle,
          articleDescription,
          logger,
          credentials?.linkedin
        );
      } else {
        result = await postLinkedInUpdate(fullContent, logger, credentials?.linkedin);
      }

      if (result) {
        return { platform, success: true, postId: result.id, postUrl: result.url };
      }
      return { platform, success: false, error: 'LinkedIn posting failed' };
    }

    default:
      return { platform, success: false, error: `Publishing to ${platform} is not yet supported. Supported: twitter, linkedin.` };
  }
}

/**
 * Publish to multiple platforms at once.
 */
export async function publishMulti(
  requests: PublishRequest[],
  logger?: Logger,
  context: PublishContext = {},
): Promise<PublishResult[]> {
  const results: PublishResult[] = [];
  for (const req of requests) {
    const result = await publish(req, logger, context);
    results.push(result);
    // Small delay between platforms
    await new Promise(r => setTimeout(r, 100));
  }
  return results;
}

// ─── Queue Management ─────────────────────────────────────────

/**
 * Add item to publish queue.
 */
export function queuePublish(
  request: PublishRequest,
  userId: string,
  brandId: string,
  runId?: string,
  scheduledAt?: string,
): PublishQueueItem {
  const createdAt = nowIso();
  const item: PublishQueueItem = {
    id: makeQueueId(),
    userId,
    request,
    brandId,
    runId,
    scheduledAt,
    status: 'pending',
    attemptCount: 0,
    createdAt,
    updatedAt: createdAt,
  };
  saveQueueItem(item);
  return item;
}

/**
 * Process pending items in the queue.
 */
export async function processQueue(options: ProcessQueueOptions = {}): Promise<PublishResult[]> {
  const now = options.now ?? new Date();
  const dueBefore = now.toISOString();

  const pending = queueStore
    ? queueStore
      .list({
        userId: options.userId,
        status: 'pending',
        dueBefore,
        limit: options.limit ?? 50,
      })
      .map(toQueueItem)
    : publishQueueMemory.filter(item => {
      if (options.userId && item.userId !== options.userId) return false;
      if (item.status !== 'pending') return false;
      if (item.scheduledAt && new Date(item.scheduledAt) > now) return false;
      if (item.nextAttemptAt && new Date(item.nextAttemptAt) > now) return false;
      return true;
    });

  const results: PublishResult[] = [];
  for (const item of pending) {
    const credentials = options.resolveCredentials
      ? await options.resolveCredentials(item.userId)
      : undefined;
    const result = await publish(item.request, options.logger, { userId: item.userId, credentials });
    results.push(result);

    const updatedAt = nowIso();
    item.result = result;
    item.updatedAt = updatedAt;

    if (result.success) {
      item.status = 'published';
      item.nextAttemptAt = undefined;
      item.lastError = undefined;
      saveQueueItem(item);
      continue;
    }

    const nextAttemptCount = item.attemptCount + 1;
    item.attemptCount = nextAttemptCount;
    item.lastError = result.error ?? 'Unknown publish error';

    if (nextAttemptCount >= MAX_RETRY_ATTEMPTS) {
      item.status = 'failed';
      item.nextAttemptAt = undefined;
    } else {
      item.status = 'pending';
      item.nextAttemptAt = new Date(now.getTime() + getRetryDelayMs(nextAttemptCount)).toISOString();
    }
    saveQueueItem(item);
  }
  return results;
}

/**
 * Get queue items.
 */
export function getQueue(filters?: {
  userId?: string;
  status?: string;
  brandId?: string;
  limit?: number;
}): PublishQueueItem[] {
  if (queueStore) {
    return queueStore.list({
      userId: filters?.userId,
      status: filters?.status as PublishQueueStatus | undefined,
      brandId: filters?.brandId,
      limit: filters?.limit,
    }).map(toQueueItem);
  }

  let items = [...publishQueueMemory];
  if (filters?.userId) items = items.filter(i => i.userId === filters.userId);
  if (filters?.status) items = items.filter(i => i.status === filters.status);
  if (filters?.brandId) items = items.filter(i => i.brandId === filters.brandId);
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Cancel a queued item.
 */
export function cancelQueueItem(id: string, userId?: string): boolean {
  if (queueStore) {
    const found = queueStore.get(id);
    if (!found) return false;
    const item = toQueueItem(found);
    if (userId && item.userId !== userId) return false;
    if (item.status !== 'pending') return false;
    item.status = 'cancelled';
    item.updatedAt = nowIso();
    saveQueueItem(item);
    return true;
  }

  const item = publishQueueMemory.find(i => i.id === id);
  if (!item) return false;
  if (userId && item.userId !== userId) return false;
  if (item.status !== 'pending') return false;
  item.status = 'cancelled';
  item.updatedAt = nowIso();
  return true;
}

// ─── Status ───────────────────────────────────────────────────

/**
 * Check which platforms are configured.
 */
export function getConfiguredPlatforms(credentials?: SocialCredentials): Record<string, {
  configured: boolean;
  handle?: string;
  personUrn?: string;
}> {
  return {
    twitter: {
      configured: isTwitterConfigured(credentials?.twitter),
      handle: credentials?.twitter?.handle,
    },
    linkedin: {
      configured: isLinkedInConfigured(credentials?.linkedin),
      personUrn: credentials?.linkedin?.personUrn,
    },
    instagram: { configured: false },
    tiktok: { configured: false },
    facebook: { configured: false },
    telegram: { configured: false },
    discord: { configured: false },
  };
}

/**
 * Verify all configured platform tokens.
 */
export async function verifyAllTokens(logger?: Logger, credentials?: SocialCredentials): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  if (isTwitterConfigured(credentials?.twitter)) {
    // Twitter doesn't have a simple verify endpoint with OAuth 1.0a
    // We trust config completeness and rely on first publish attempt.
    results.twitter = true;
  }

  if (isLinkedInConfigured(credentials?.linkedin)) {
    results.linkedin = await verifyLinkedInToken(logger, credentials?.linkedin);
  }

  return results;
}

export function __resetSocialPublishingForTests(): void {
  publishQueueMemory.length = 0;
  if (queueStore) {
    queueStore.close();
    queueStore = null;
  }
}

// Re-export
export { isTwitterConfigured, isLinkedInConfigured };
export type { TweetResult, ThreadResult, LinkedInPostResult };
