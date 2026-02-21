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

export function createPublishRoutes(): Router {
  const router = Router();

  function getRequestId(req: AuthenticatedRequest): string {
    const fromResponse = req.res?.getHeader('x-request-id');
    if (typeof fromResponse === 'string' && fromResponse.trim()) return fromResponse.trim();
    const fromRequest = req.header?.('x-request-id');
    if (typeof fromRequest === 'string' && fromRequest.trim()) return fromRequest.trim();
    return 'unknown';
  }

  function makeRouteLogger(req: AuthenticatedRequest, userId?: string) {
    const base = {
      requestId: getRequestId(req),
      method: req.method,
      path: req.originalUrl,
      userId: userId ?? null,
      source: 'publish_routes',
    };

    return {
      info: (msg: string, meta?: Record<string, unknown>) => console.log(JSON.stringify({ level: 'info', message: msg, ...base, ...(meta ?? {}) })),
      warn: (msg: string, meta?: Record<string, unknown>) => console.warn(JSON.stringify({ level: 'warn', message: msg, ...base, ...(meta ?? {}) })),
      error: (msg: string, meta?: Record<string, unknown>) => console.error(JSON.stringify({ level: 'error', message: msg, ...base, ...(meta ?? {}) })),
      debug: (msg: string, meta?: Record<string, unknown>) => console.debug(JSON.stringify({ level: 'debug', message: msg, ...base, ...(meta ?? {}) })),
    };
  }

  function errorResponse(req: AuthenticatedRequest, res: any, statusCode: number, message: string) {
    const requestId = getRequestId(req);
    res.status(statusCode).json({ error: message, requestId });
  }

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
        errorResponse(req as AuthenticatedRequest, res, 401, 'Unauthorized');
        return;
      }
      const logger = makeRouteLogger(req as AuthenticatedRequest, userId);

      const { platform, content, hashtags, media, articleUrl, articleTitle, articleDescription, isThread } = req.body;
      if (!platform || !content) {
        return errorResponse(req as AuthenticatedRequest, res, 400, 'platform and content are required');
      }

      const request: PublishRequest = {
        platform, content, hashtags, media,
        articleUrl, articleTitle, articleDescription, isThread,
      };
      const result = await publish(request, logger, {
        userId,
        credentials: getSocialCredentials(userId),
      });
      res.json({ ...result, requestId: getRequestId(req as AuthenticatedRequest) });
    } catch (err) {
      errorResponse(req as AuthenticatedRequest, res, 500, String(err));
    }
  });

  // Publish to multiple platforms
  router.post('/multi', async (req, res) => {
    try {
      const userId = getRequestUserId(req as AuthenticatedRequest);
      if (!userId) {
        errorResponse(req as AuthenticatedRequest, res, 401, 'Unauthorized');
        return;
      }
      const logger = makeRouteLogger(req as AuthenticatedRequest, userId);

      const { requests } = req.body;
      if (!Array.isArray(requests) || requests.length === 0) {
        return errorResponse(req as AuthenticatedRequest, res, 400, 'requests array is required');
      }

      const results = await publishMulti(requests, logger, {
        userId,
        credentials: getSocialCredentials(userId),
      });
      res.json({
        results,
        summary: { total: results.length, success: results.filter(r => r.success).length },
        requestId: getRequestId(req as AuthenticatedRequest),
      });
    } catch (err) {
      errorResponse(req as AuthenticatedRequest, res, 500, String(err));
    }
  });

  // Add to queue
  router.post('/queue', (req, res) => {
    try {
      const userId = getRequestUserId(req as AuthenticatedRequest);
      if (!userId) {
        errorResponse(req as AuthenticatedRequest, res, 401, 'Unauthorized');
        return;
      }

      const { request, brandId, runId, scheduledAt } = req.body;
      if (!request?.platform || !request?.content || !brandId) {
        return errorResponse(req as AuthenticatedRequest, res, 400, 'request (with platform, content) and brandId are required');
      }

      const item = queuePublish(request, userId, brandId, runId, scheduledAt);
      res.status(201).json({ ...item, requestId: getRequestId(req as AuthenticatedRequest) });
    } catch (err) {
      errorResponse(req as AuthenticatedRequest, res, 500, String(err));
    }
  });

  // Process queue
  router.post('/process', async (req, res) => {
    try {
      const userId = getRequestUserId(req as AuthenticatedRequest);
      if (!userId) {
        errorResponse(req as AuthenticatedRequest, res, 401, 'Unauthorized');
        return;
      }
      const logger = makeRouteLogger(req as AuthenticatedRequest, userId);

      const results = await processQueue({
        logger,
        userId,
        resolveCredentials: id => getSocialCredentials(id),
      });
      res.json({ processed: results.length, results, requestId: getRequestId(req as AuthenticatedRequest) });
    } catch (err) {
      errorResponse(req as AuthenticatedRequest, res, 500, String(err));
    }
  });

  // Get queue
  router.get('/queue', (req, res) => {
    try {
      const userId = getRequestUserId(req as AuthenticatedRequest);
      if (!userId) {
        errorResponse(req as AuthenticatedRequest, res, 401, 'Unauthorized');
        return;
      }

      const { status, brandId } = req.query;
      const items = getQueue({
        userId,
        status: status as string | undefined,
        brandId: brandId as string | undefined,
        limit: parseLimit(req.query.limit, 100),
      });
      res.json({ items, total: items.length, requestId: getRequestId(req as AuthenticatedRequest) });
    } catch (err) {
      errorResponse(req as AuthenticatedRequest, res, 500, String(err));
    }
  });

  router.get('/dead-letter', (req, res) => {
    try {
      const userId = getRequestUserId(req as AuthenticatedRequest);
      if (!userId) {
        errorResponse(req as AuthenticatedRequest, res, 401, 'Unauthorized');
        return;
      }

      const { brandId } = req.query;
      const items = getQueue({
        userId,
        status: 'failed',
        brandId: brandId as string | undefined,
        limit: parseLimit(req.query.limit, 100),
      });
      res.json({ items, total: items.length, requestId: getRequestId(req as AuthenticatedRequest) });
    } catch (err) {
      errorResponse(req as AuthenticatedRequest, res, 500, String(err));
    }
  });

  router.post('/retry/:id', (req, res) => {
    try {
      const userId = getRequestUserId(req as AuthenticatedRequest);
      if (!userId) {
        errorResponse(req as AuthenticatedRequest, res, 401, 'Unauthorized');
        return;
      }

      const item = retryQueueItem(req.params.id, userId);
      if (!item) {
        errorResponse(req as AuthenticatedRequest, res, 404, 'Failed queue item not found');
        return;
      }
      res.json({ retried: true, item, requestId: getRequestId(req as AuthenticatedRequest) });
    } catch (err) {
      errorResponse(req as AuthenticatedRequest, res, 500, String(err));
    }
  });

  // Cancel queue item
  router.delete('/queue/:id', (req, res) => {
    try {
      const userId = getRequestUserId(req as AuthenticatedRequest);
      if (!userId) {
        errorResponse(req as AuthenticatedRequest, res, 401, 'Unauthorized');
        return;
      }

      const success = cancelQueueItem(req.params.id, userId);
      if (success) {
        res.json({ cancelled: true, requestId: getRequestId(req as AuthenticatedRequest) });
      } else {
        errorResponse(req as AuthenticatedRequest, res, 404, 'Item not found or already processed');
      }
    } catch (err) {
      errorResponse(req as AuthenticatedRequest, res, 500, String(err));
    }
  });

  // Platform status
  router.get('/status', async (req, res) => {
    const userId = getRequestUserId(req as AuthenticatedRequest);
    if (!userId) {
      errorResponse(req as AuthenticatedRequest, res, 401, 'Unauthorized');
      return;
    }

    const credentials = getSocialCredentials(userId);
    const configured = getConfiguredPlatforms(credentials);
    const verify = req.query.verify === 'true';
    const logger = makeRouteLogger(req as AuthenticatedRequest, userId);
    const verified = verify ? await verifyAllTokens(logger, credentials) : undefined;
    res.json({ platforms: configured, verified, requestId: getRequestId(req as AuthenticatedRequest) });
  });

  return router;
}
