import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import type { Logger } from '../src/core/types.js';
import {
  approveQueueItem,
  __resetPublishQueueForTests,
  getConfiguredPlatforms,
  getQueueItemById,
  getQueueSummary,
  getQueue,
  initPublishQueueDB,
  processQueue,
  publish,
  queuePublish,
  verifyAllTokens,
} from '../src/services/social/index.js';

let twitterConfigured = false;
let linkedinConfigured = false;
let instagramConfigured = false;
let linkedinTokenValid = false;
let instagramTokenValid = false;
let instagramThrows = false;
let instagramPostResult: { id: string; url: string } | null = null;
const TEST_ROOT = join(import.meta.dirname ?? '.', '__social_publish_test_tmp__');

vi.mock('../src/services/social/twitter.js', () => ({
  isTwitterConfigured: () => twitterConfigured,
  postTweet: vi.fn(async (text: string) => ({ id: 'tweet-1', text, url: 'https://x.com/i/status/tweet-1' })),
  postThread: vi.fn(async (tweets: string[]) => ({
    tweets: tweets.map((text, idx) => ({ id: `tweet-${idx}`, text, url: `https://x.com/i/status/tweet-${idx}` })),
    threadUrl: 'https://x.com/i/status/tweet-0',
  })),
}));

vi.mock('../src/services/social/linkedin.js', () => ({
  isLinkedInConfigured: () => linkedinConfigured,
  verifyLinkedInToken: vi.fn(async () => linkedinTokenValid),
  postLinkedInUpdate: vi.fn(async () => ({ id: 'li-1', url: 'https://linkedin.com/feed/update/li-1' })),
  postLinkedInArticle: vi.fn(async () => ({ id: 'li-article', url: 'https://linkedin.com/feed/update/li-article' })),
}));

vi.mock('../src/services/social/instagram.js', () => ({
  isInstagramConfigured: () => instagramConfigured,
  verifyInstagramToken: vi.fn(async () => instagramTokenValid),
  postInstagramImage: vi.fn(async () => {
    if (instagramThrows) {
      throw new Error('instagram exploded');
    }
    return instagramPostResult;
  }),
}));

const logger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

describe('social publishing manager', () => {
  beforeEach(() => {
    if (existsSync(TEST_ROOT)) {
      rmSync(TEST_ROOT, { recursive: true, force: true });
    }
    mkdirSync(TEST_ROOT, { recursive: true });
    initPublishQueueDB(TEST_ROOT);

    twitterConfigured = false;
    linkedinConfigured = false;
    instagramConfigured = false;
    linkedinTokenValid = false;
    instagramTokenValid = false;
    instagramThrows = false;
    instagramPostResult = null;
  });

  afterEach(() => {
    __resetPublishQueueForTests();
    if (existsSync(TEST_ROOT)) {
      rmSync(TEST_ROOT, { recursive: true, force: true });
    }
  });

  it('publishes an Instagram post when configured with media', async () => {
    instagramConfigured = true;
    instagramPostResult = { id: 'ig-1', url: 'https://instagram.com/p/ig-1' };

    const result = await publish({
      platform: 'instagram',
      content: 'Launch update',
      media: ['https://cdn.example.com/image.jpg'],
    }, logger);

    expect(result).toEqual({
      platform: 'instagram',
      success: true,
      postId: 'ig-1',
      postUrl: 'https://instagram.com/p/ig-1',
    });
  });

  it('fails Instagram publish when media is missing', async () => {
    instagramConfigured = true;

    const result = await publish({
      platform: 'instagram',
      content: 'No media available',
    }, logger);

    expect(result.success).toBe(false);
    expect(result.error).toContain('requires at least one public media URL');
  });

  it('reports configured platform status using provider checks', () => {
    twitterConfigured = true;
    instagramConfigured = true;

    expect(getConfiguredPlatforms()).toMatchObject({
      twitter: true,
      linkedin: false,
      instagram: true,
    });
  });

  it('verifies tokens only for configured providers', async () => {
    twitterConfigured = true;
    linkedinConfigured = true;
    instagramConfigured = true;
    linkedinTokenValid = true;
    instagramTokenValid = false;

    const result = await verifyAllTokens(logger);

    expect(result).toEqual({
      twitter: true,
      linkedin: true,
      instagram: false,
    });
  });

  it('marks queued publish as failed when provider throws', async () => {
    instagramConfigured = true;
    instagramThrows = true;
    queuePublish(
      {
        platform: 'instagram',
        content: 'Queued publish',
        media: ['https://cdn.example.com/image.jpg'],
      },
      'brand-1',
      'run-1',
    );

    const results = await processQueue(logger);
    const queue = getQueue({ brandId: 'brand-1' });

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('instagram exploded');
    expect(queue[0].status).toBe('failed');
  });

  it('holds pending-approval items until approved', async () => {
    twitterConfigured = true;
    const created = queuePublish(
      {
        platform: 'twitter',
        content: 'Queue me after approval',
      },
      'brand-2',
      'run-2',
      undefined,
      { requiresApproval: true },
    );

    const beforeProcess = await processQueue(logger);
    expect(beforeProcess).toHaveLength(0);
    expect(getQueueItemById(created.id)?.status).toBe('pending_approval');

    const approved = approveQueueItem(created.id, 'qa-reviewer');
    expect(approved?.status).toBe('pending');
    expect(approved?.approvedBy).toBe('qa-reviewer');

    const afterProcess = await processQueue(logger);
    expect(afterProcess).toHaveLength(1);
    expect(afterProcess[0].success).toBe(true);
    expect(getQueueItemById(created.id)?.status).toBe('published');

    const summary = getQueueSummary('brand-2');
    expect(summary.published).toBe(1);
    expect(summary.pending_approval).toBe(0);
  });

  it('persists queue items across service re-initialization', () => {
    const created = queuePublish(
      {
        platform: 'linkedin',
        content: 'Persist me',
      },
      'brand-3',
      'run-3',
    );

    // Close current DB connection and reopen from same data path.
    __resetPublishQueueForTests();
    initPublishQueueDB(TEST_ROOT);

    const loaded = getQueueItemById(created.id);
    expect(loaded?.id).toBe(created.id);
    expect(loaded?.brandId).toBe('brand-3');
    expect(loaded?.status).toBe('pending');
  });
});
