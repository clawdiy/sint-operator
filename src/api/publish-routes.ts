/**
 * Social Publishing API Routes
 * 
 * POST /api/publish          — Publish content to a platform
 * POST /api/publish/multi    — Publish to multiple platforms
 * POST /api/publish/queue    — Add to publish queue
 * POST /api/publish/process  — Process pending queue items
 * GET  /api/publish/queue    — Get queue items
 * GET  /api/publish/dead-letter — Get permanently failed queue items
 * POST /api/publish/retry/:id — Retry a failed queue item
 * DELETE /api/publish/queue/:id — Cancel queued item
 * GET  /api/publish/status   — Check configured platforms
 */

import { Router } from 'express';
import {
  publish,
  publishMulti,
  queuePublish,
  processQueue,
  getQueue,
  cancelQueueItem,
  retryQueueItem,
  getConfiguredPlatforms,
  verifyAllTokens,
  type PublishRequest,
} from '../services/social/index.js';
import type { AuthenticatedRequest } from '../auth/auth-middleware.js';
import { getSocialCredentials } from '../auth/social-account-service.js';

const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => console.log(`[publish] ${msg}`, meta ?? ''),
  warn: (msg: string, meta?: Record<string, unknown>) => console.warn(`[publish] ${msg}`, meta ?? ''),
  error: (msg: string, meta?: Record<string, unknown>) => console.error(`[publish] ${msg}`, meta ?? ''),
  debug: (msg: string, meta?: Record<string, unknown>) => console.debug(`[publish] ${msg}`, meta ?? ''),
};

export function createPublishRoutes(): Router {
  const router = Router();

  function getRequestUserId(req: AuthenticatedRequest): string | null {
    if (process.env.AUTH_ENABLED !== 'true') return 'default';
    return req.user?.userId ?? null;
  }

  function parseLimit(raw: unknown, fallback: number): number {
    const parsed = Number.parseInt(String(raw ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, 250);
  }

  // Publish immediately to a single platform
  router.post('/', async (req, res) => {
    try {
      const userId = getRequestUserId(req as AuthenticatedRequest);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { platform, content, hashtags, media, articleUrl, articleTitle, articleDescription, isThread } = req.body;
      if (!platform || !content) {
        return res.status(400).json({ error: 'platform and content are required' });
      }

      const request: PublishRequest = {
        platform, content, hashtags, media,
        articleUrl, articleTitle, articleDescription, isThread,
      };
      const result = await publish(request, logger, {
        userId,
        credentials: getSocialCredentials(userId),
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Publish to multiple platforms
  router.post('/multi', async (req, res) => {
    try {
      const userId = getRequestUserId(req as AuthenticatedRequest);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { requests } = req.body;
      if (!Array.isArray(requests) || requests.length === 0) {
        return res.status(400).json({ error: 'requests array is required' });
      }

      const results = await publishMulti(requests, logger, {
        userId,
        credentials: getSocialCredentials(userId),
      });
      res.json({ results, summary: { total: results.length, success: results.filter(r => r.success).length } });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Add to queue
  router.post('/queue', (req, res) => {
    try {
      const userId = getRequestUserId(req as AuthenticatedRequest);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { request, brandId, runId, scheduledAt } = req.body;
      if (!request?.platform || !request?.content || !brandId) {
        return res.status(400).json({ error: 'request (with platform, content) and brandId are required' });
      }

      const item = queuePublish(request, userId, brandId, runId, scheduledAt);
      res.status(201).json(item);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Process queue
  router.post('/process', async (req, res) => {
    try {
      const userId = getRequestUserId(req as AuthenticatedRequest);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const results = await processQueue({
        logger,
        userId,
        resolveCredentials: id => getSocialCredentials(id),
      });
      res.json({ processed: results.length, results });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Get queue
  router.get('/queue', (req, res) => {
    try {
      const userId = getRequestUserId(req as AuthenticatedRequest);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { status, brandId } = req.query;
      const items = getQueue({
        userId,
        status: status as string | undefined,
        brandId: brandId as string | undefined,
        limit: parseLimit(req.query.limit, 100),
      });
      res.json({ items, total: items.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.get('/dead-letter', (req, res) => {
    try {
      const userId = getRequestUserId(req as AuthenticatedRequest);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { brandId } = req.query;
      const items = getQueue({
        userId,
        status: 'failed',
        brandId: brandId as string | undefined,
        limit: parseLimit(req.query.limit, 100),
      });
      res.json({ items, total: items.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post('/retry/:id', (req, res) => {
    try {
      const userId = getRequestUserId(req as AuthenticatedRequest);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const item = retryQueueItem(req.params.id, userId);
      if (!item) {
        res.status(404).json({ error: 'Failed queue item not found' });
        return;
      }
      res.json({ retried: true, item });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Cancel queue item
  router.delete('/queue/:id', (req, res) => {
    try {
      const userId = getRequestUserId(req as AuthenticatedRequest);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const success = cancelQueueItem(req.params.id, userId);
      if (success) {
        res.json({ cancelled: true });
      } else {
        res.status(404).json({ error: 'Item not found or already processed' });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Platform status
  router.get('/status', async (req, res) => {
    const userId = getRequestUserId(req as AuthenticatedRequest);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const credentials = getSocialCredentials(userId);
    const configured = getConfiguredPlatforms(credentials);
    const verify = req.query.verify === 'true';
    const verified = verify ? await verifyAllTokens(logger, credentials) : undefined;
    res.json({ platforms: configured, verified });
  });

  return router;
}
