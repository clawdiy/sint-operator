/**
 * Social Publishing API Routes
 * 
 * POST /api/publish          — Publish content to a platform
 * POST /api/publish/multi    — Publish to multiple platforms
 * POST /api/publish/queue    — Add to publish queue
 * POST /api/publish/process  — Process pending queue items
 * GET  /api/publish/queue    — Get queue items
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
  getConfiguredPlatforms,
  verifyAllTokens,
  type PublishRequest,
} from '../services/social/index.js';

const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => console.log(`[publish] ${msg}`, meta ?? ''),
  warn: (msg: string, meta?: Record<string, unknown>) => console.warn(`[publish] ${msg}`, meta ?? ''),
  error: (msg: string, meta?: Record<string, unknown>) => console.error(`[publish] ${msg}`, meta ?? ''),
  debug: (msg: string, meta?: Record<string, unknown>) => console.debug(`[publish] ${msg}`, meta ?? ''),
};

export function createPublishRoutes(): Router {
  const router = Router();

  // Publish immediately to a single platform
  router.post('/', async (req, res) => {
    try {
      const { platform, content, hashtags, media, articleUrl, articleTitle, articleDescription, isThread } = req.body;
      if (!platform || !content) {
        return res.status(400).json({ error: 'platform and content are required' });
      }

      const request: PublishRequest = {
        platform, content, hashtags, media,
        articleUrl, articleTitle, articleDescription, isThread,
      };
      const result = await publish(request, logger);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Publish to multiple platforms
  router.post('/multi', async (req, res) => {
    try {
      const { requests } = req.body;
      if (!Array.isArray(requests) || requests.length === 0) {
        return res.status(400).json({ error: 'requests array is required' });
      }

      const results = await publishMulti(requests, logger);
      res.json({ results, summary: { total: results.length, success: results.filter(r => r.success).length } });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Add to queue
  router.post('/queue', (req, res) => {
    try {
      const { request, brandId, runId, scheduledAt } = req.body;
      if (!request?.platform || !request?.content || !brandId) {
        return res.status(400).json({ error: 'request (with platform, content) and brandId are required' });
      }

      const item = queuePublish(request, brandId, runId, scheduledAt);
      res.status(201).json(item);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Process queue
  router.post('/process', async (req, res) => {
    try {
      const results = await processQueue(logger);
      res.json({ processed: results.length, results });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Get queue
  router.get('/queue', (req, res) => {
    const { status, brandId } = req.query;
    const items = getQueue({
      status: status as string | undefined,
      brandId: brandId as string | undefined,
    });
    res.json({ items, total: items.length });
  });

  // Cancel queue item
  router.delete('/queue/:id', (req, res) => {
    const success = cancelQueueItem(req.params.id);
    if (success) {
      res.json({ cancelled: true });
    } else {
      res.status(404).json({ error: 'Item not found or already processed' });
    }
  });

  // Platform status
  router.get('/status', async (req, res) => {
    const configured = getConfiguredPlatforms();
    const verify = req.query.verify === 'true';
    const verified = verify ? await verifyAllTokens(logger) : undefined;
    res.json({ platforms: configured, verified });
  });

  return router;
}
