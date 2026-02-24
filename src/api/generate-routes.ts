/**
 * Image & Video Generation API Routes
 * 
 * POST /api/generate/image         — Generate image from prompt
 * POST /api/generate/video         — Submit video generation job
 * GET  /api/generate/video/:jobId  — Check video job status
 */

import { Router, type Request, type Response } from 'express';
import { generateImage, type ImageGenRequest } from '../services/image-gen/index.js';
import { getVideoGen, type VideoGenProviderType } from '../services/video-gen/index.js';

export function createGenerateRoutes(config: { openaiApiKey?: string }): Router {
  const router = Router();

  // POST /api/generate/image
  router.post('/image', async (req: Request, res: Response) => {
    try {
      const { prompt, size, style, model, n } = req.body as ImageGenRequest;
      if (!prompt) {
        res.status(400).json({ error: 'prompt is required' });
        return;
      }

      const results = await generateImage({ prompt, size, style, model, n });
      res.json({
        success: true,
        images: results,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image generation failed';
      res.status(500).json({ error: message });
    }
  });

  // POST /api/generate/video
  router.post('/video', async (req: Request, res: Response) => {
    try {
      const { prompt, image_url, duration, provider, webhook_url } = req.body as {
        prompt?: string;
        image_url?: string;
        duration?: number;
        provider?: VideoGenProviderType;
        webhook_url?: string;
      };

      if (!prompt && !image_url) {
        res.status(400).json({ error: 'prompt or image_url is required' });
        return;
      }

      const videoGen = getVideoGen(provider ?? 'runway');
      const job = await videoGen.submit({
        prompt,
        imageUrl: image_url,
        duration,
        webhookUrl: webhook_url,
      });

      res.json({ success: true, job });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Video generation failed';
      res.status(500).json({ error: message });
    }
  });

  // GET /api/generate/video/:jobId
  router.get('/video/:jobId', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const provider = (req.query.provider as VideoGenProviderType) ?? 'runway';
      const videoGen = getVideoGen(provider);
      const status = await videoGen.checkStatus(jobId);
      res.json({ success: true, job: status });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Status check failed';
      res.status(500).json({ error: message });
    }
  });

  return router;
}
