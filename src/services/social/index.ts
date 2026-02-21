/**
 * Social Publishing Manager
 * 
 * Unified interface for publishing content to social platforms.
 * Handles: Twitter/X, LinkedIn (more to come: Instagram, Telegram, Discord)
 */

import { postTweet, postThread, isTwitterConfigured, type TweetResult, type ThreadResult } from './twitter.js';
import { postLinkedInUpdate, postLinkedInArticle, isLinkedInConfigured, verifyLinkedInToken, type LinkedInPostResult } from './linkedin.js';
import {
  postInstagramImage,
  isInstagramConfigured,
  verifyInstagramToken,
  type InstagramPostResult,
} from './instagram.js';
import type { Platform, Logger } from '../../core/types.js';

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
  request: PublishRequest;
  brandId: string;
  runId?: string;
  scheduledAt?: string;
  status: 'pending' | 'published' | 'failed' | 'cancelled';
  result?: PublishResult;
  createdAt: string;
}

// ─── In-memory queue (swap for DB in production) ──────────────

const publishQueue: PublishQueueItem[] = [];

// ─── Publishing ───────────────────────────────────────────────

/**
 * Publish content to a single platform.
 */
export async function publish(
  request: PublishRequest,
  logger?: Logger,
): Promise<PublishResult> {
  const {
    platform,
    content,
    hashtags,
    media,
    articleUrl,
    articleTitle,
    articleDescription,
    isThread,
  } = request;

  // Append hashtags to content if present
  const fullContent = hashtags && hashtags.length > 0
    ? `${content}\n\n${hashtags.map(t => t.startsWith('#') ? t : `#${t}`).join(' ')}`
    : content;

  switch (platform) {
    case 'twitter': {
      if (!isTwitterConfigured()) {
        return { platform, success: false, error: 'Twitter credentials not configured. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET.' };
      }

      if (isThread) {
        // Split content by /1, /2 markers or double newlines
        const parts = fullContent.includes('/1')
          ? fullContent.split(/\/\d+\s*\n?/).filter(Boolean).map(s => s.trim())
          : fullContent.split(/\n\n+/).filter(s => s.trim().length > 0);
        
        const threadResult = await postThread(parts, logger);
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
      const tweetResult = await postTweet(tweetText, logger);
      if (tweetResult) {
        return { platform, success: true, postId: tweetResult.id, postUrl: tweetResult.url };
      }
      return { platform, success: false, error: 'Tweet posting failed' };
    }

    case 'linkedin': {
      if (!isLinkedInConfigured()) {
        return { platform, success: false, error: 'LinkedIn credentials not configured. Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_URN.' };
      }

      let result: LinkedInPostResult | null;
      if (articleUrl && articleTitle) {
        result = await postLinkedInArticle(fullContent, articleUrl, articleTitle, articleDescription, logger);
      } else {
        result = await postLinkedInUpdate(fullContent, logger);
      }

      if (result) {
        return { platform, success: true, postId: result.id, postUrl: result.url };
      }
      return { platform, success: false, error: 'LinkedIn posting failed' };
    }

    case 'instagram': {
      if (!isInstagramConfigured()) {
        return {
          platform,
          success: false,
          error: 'Instagram credentials not configured. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID.',
        };
      }

      const mediaUrl = media?.[0];
      if (!mediaUrl) {
        return {
          platform,
          success: false,
          error: 'Instagram requires at least one public media URL in request.media[0].',
        };
      }

      const result = await postInstagramImage(fullContent, mediaUrl, logger);
      if (result) {
        return { platform, success: true, postId: result.id, postUrl: result.url };
      }
      return { platform, success: false, error: 'Instagram posting failed' };
    }

    default:
      return { platform, success: false, error: `Publishing to ${platform} is not yet supported. Supported: twitter, linkedin, instagram.` };
  }
}

/**
 * Publish to multiple platforms at once.
 */
export async function publishMulti(
  requests: PublishRequest[],
  logger?: Logger,
): Promise<PublishResult[]> {
  const results: PublishResult[] = [];
  for (const req of requests) {
    const result = await publish(req, logger);
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
  brandId: string,
  runId?: string,
  scheduledAt?: string,
): PublishQueueItem {
  const item: PublishQueueItem = {
    id: `pub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    request,
    brandId,
    runId,
    scheduledAt,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  publishQueue.push(item);
  return item;
}

/**
 * Process pending items in the queue.
 */
export async function processQueue(logger?: Logger): Promise<PublishResult[]> {
  const now = new Date();
  const pending = publishQueue.filter(item => {
    if (item.status !== 'pending') return false;
    if (item.scheduledAt && new Date(item.scheduledAt) > now) return false;
    return true;
  });

  const results: PublishResult[] = [];
  for (const item of pending) {
    try {
      const result = await publish(item.request, logger);
      item.result = result;
      item.status = result.success ? 'published' : 'failed';
      results.push(result);
    } catch (err) {
      const failedResult: PublishResult = {
        platform: item.request.platform,
        success: false,
        error: String(err),
      };
      item.result = failedResult;
      item.status = 'failed';
      logger?.error('Queued publish failed with exception', {
        queueItemId: item.id,
        platform: item.request.platform,
        error: String(err),
      });
      results.push(failedResult);
    }
  }
  return results;
}

/**
 * Get queue items.
 */
export function getQueue(filters?: { status?: string; brandId?: string }): PublishQueueItem[] {
  let items = [...publishQueue];
  if (filters?.status) items = items.filter(i => i.status === filters.status);
  if (filters?.brandId) items = items.filter(i => i.brandId === filters.brandId);
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Cancel a queued item.
 */
export function cancelQueueItem(id: string): boolean {
  const item = publishQueue.find(i => i.id === id);
  if (!item || item.status !== 'pending') return false;
  item.status = 'cancelled';
  return true;
}

/**
 * Test hook for clearing in-memory queue state.
 */
export function __resetPublishQueueForTests(): void {
  publishQueue.splice(0, publishQueue.length);
}

// ─── Status ───────────────────────────────────────────────────

/**
 * Check which platforms are configured.
 */
export function getConfiguredPlatforms(): Record<string, boolean> {
  return {
    twitter: isTwitterConfigured(),
    linkedin: isLinkedInConfigured(),
    instagram: isInstagramConfigured(),
    tiktok: false,
    facebook: false,
    telegram: false,
    discord: false,
  };
}

/**
 * Verify all configured platform tokens.
 */
export async function verifyAllTokens(logger?: Logger): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  
  if (isTwitterConfigured()) {
    // Twitter doesn't have a simple verify endpoint with OAuth 1.0a
    // We trust the config exists
    results.twitter = true;
  }

  if (isLinkedInConfigured()) {
    results.linkedin = await verifyLinkedInToken(logger);
  }

  if (isInstagramConfigured()) {
    results.instagram = await verifyInstagramToken(logger);
  }

  return results;
}

// Re-export
export { isTwitterConfigured, isLinkedInConfigured, isInstagramConfigured };
export type { TweetResult, ThreadResult, LinkedInPostResult, InstagramPostResult };
