/**
 * REST API Server v2
 * 
 * HTTP interface with metering endpoints, skill discovery,
 * and usage tracking.
 */

import express from 'express';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import multer from 'multer';
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
      version: '0.2.0',
      name: 'SINT Marketing Operator',
      skills: orchestrator.listSkills().length,
      brands: orchestrator.listBrands().length,
      pipelines: orchestrator.listPipelines().length,
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

  // ─── Skills ─────────────────────────────────────────────

  app.get('/api/skills', (_req, res) => {
    res.json(orchestrator.listSkills());
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
    console.log(`   Health:   GET  /health`);
    console.log(`   Skills:   GET  /api/skills`);
    console.log(`   Usage:    GET  /api/usage`);
    console.log(`   Repurpose: POST /api/repurpose`);
    console.log(`   Blog:      POST /api/blog`);
    console.log(`   Calendar:  POST /api/calendar\n`);
  });

  return { app, server };
}
