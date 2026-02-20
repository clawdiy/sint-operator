/**
 * REST API Server
 * 
 * HTTP interface for the Marketing Orchestrator.
 * Runs on localhost:18789 by default.
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { join } from 'path';
import type { Orchestrator } from '../orchestrator/index.js';

export function createServer(orchestrator: Orchestrator, port: number = 18789) {
  const app = express();
  
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  const upload = multer({ dest: '/tmp/sint-uploads/' });

  // ─── Health ─────────────────────────────────────────────

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '0.1.0',
      name: 'SINT Marketing Operator',
    });
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

  app.post('/api/pipelines/:id/run', async (req, res) => {
    try {
      const { brandId, inputs } = req.body;
      if (!brandId) return res.status(400).json({ error: 'brandId required' });
      
      const run = await orchestrator.runPipeline(req.params.id, brandId, inputs ?? {});
      res.json(run);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // ─── Quick Actions ──────────────────────────────────────

  app.post('/api/repurpose', async (req, res) => {
    try {
      const { brandId, content, platforms } = req.body;
      if (!brandId || !content || !platforms) {
        return res.status(400).json({ error: 'brandId, content, and platforms required' });
      }
      const run = await orchestrator.repurposeContent(brandId, content, platforms);
      res.json(run);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  app.post('/api/blog', async (req, res) => {
    try {
      const { brandId, topic, keywords } = req.body;
      if (!brandId || !topic) {
        return res.status(400).json({ error: 'brandId and topic required' });
      }
      const run = await orchestrator.generateBlogPost(brandId, topic, keywords ?? []);
      res.json(run);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  app.post('/api/calendar', async (req, res) => {
    try {
      const { brandId, days, themes } = req.body;
      if (!brandId || !days) {
        return res.status(400).json({ error: 'brandId and days required' });
      }
      const run = await orchestrator.generateSocialCalendar(brandId, days, themes ?? []);
      res.json(run);
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

  // ─── Runs ───────────────────────────────────────────────

  app.get('/api/runs', (_req, res) => {
    res.json(orchestrator.listRuns());
  });

  app.get('/api/runs/:id', (req, res) => {
    const run = orchestrator.getRun(req.params.id);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  });

  // ─── Start ──────────────────────────────────────────────

  const server = app.listen(port, () => {
    console.log(`\n🚀 SINT Marketing Operator API running at http://localhost:${port}`);
    console.log(`   Health: http://localhost:${port}/health`);
    console.log(`   API:    http://localhost:${port}/api/\n`);
  });

  return { app, server };
}
