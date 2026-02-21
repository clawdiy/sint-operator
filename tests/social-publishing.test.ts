import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from '../src/core/types.js';
import {
  __resetPublishQueueForTests,
  getConfiguredPlatforms,
  getQueue,
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
    twitterConfigured = false;
    linkedinConfigured = false;
    instagramConfigured = false;
    linkedinTokenValid = false;
    instagramTokenValid = false;
    instagramThrows = false;
    instagramPostResult = null;
    __resetPublishQueueForTests();
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
});
