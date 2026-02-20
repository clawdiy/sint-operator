/**
 * REST API Server v3
 * 
 * HTTP interface with:
 * - Async pipeline execution (returns run ID immediately)
 * - Proper CORS for Railway deployment
 * - Request timeouts (60s pipeline, 30s other)
 * - LLM connection test endpoint
 * - Run status polling
 * - Metering endpoints
 * - Skill discovery
 */

import express from 'express';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import multer from 'multer';
import type { Orchestrator } from '../orchestrator/index.js';

// ─── Async Run Store ──────────────────────────────────────────

interface AsyncRun {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  pipelineId: string;
  brandId: string;
  startedAt: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

const asyncRuns = new Map<string, AsyncRun>();

function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createServer(orchestrator: Orchestrator, port: number = 18789) {
  const app = express();

  // ─── CORS ─────────────────────────────────────────────────
  app.use(cors({
    origin: [
      /localhost/,
      /127\.0\.0\.1/,
      /\.railway\.app$/,
      /\.up\.railway\.app$/,
      /\.vercel\.app$/,
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  }));

  app.use(express.json({ limit: '50mb' }));

  const upload = multer({ dest: '/tmp/sint-uploads/' });

  // ─── Timeout Middleware ───────────────────────────────────
  // 30s default, pipeline routes get 60s
  app.use((req, res, next) => {
    const isPipelineRoute = req.path.includes('/repurpose')
      || req.path.includes('/blog')
      || req.path.includes('/calendar')
      || (req.path.includes('/pipelines/') && req.method === 'POST');
    const timeout = isPipelineRoute ? 60_000 : 30_000;
    req.setTimeout(timeout);
    res.setTimeout(timeout);
    next();
  });

  // ─── Health ─────────────────────────────────────────────

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '0.4.0',
      name: 'SINT Marketing Operator',
      skills: orchestrator.listSkills().length,
      brands: orchestrator.listBrands().length,
      pipelines: orchestrator.listPipelines().length,
    });
  });

  // ─── LLM Test ───────────────────────────────────────────

  app.post('/api/test-llm', async (_req, res) => {
    try {
      const result = await orchestrator.testLLM();
      res.json(result);
    } catch (err) {
      res.status(500).json({
        ok: false,
        mode: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
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

      // Async execution: return run ID immediately
      const runId = generateRunId();
      const asyncRun: AsyncRun = {
        id: runId,
        status: 'queued',
        pipelineId: req.params.id,
        brandId,
        startedAt: new Date().toISOString(),
      };
      asyncRuns.set(runId, asyncRun);

      // Return immediately
      res.json({ runId, status: 'queued', message: 'Pipeline execution started. Poll GET /api/runs/:id for status.' });

      // Execute async
      asyncRun.status = 'running';
      orchestrator.runPipeline(req.params.id, brandId, inputs ?? {})
        .then(result => {
          asyncRun.status = 'completed';
          asyncRun.completedAt = new Date().toISOString();
          asyncRun.result = result;
        })
        .catch(err => {
          asyncRun.status = 'failed';
          asyncRun.completedAt = new Date().toISOString();
          asyncRun.error = err instanceof Error ? err.message : 'Unknown error';
        });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // ─── Quick Actions (async) ──────────────────────────────

  app.post('/api/repurpose', async (req, res) => {
    try {
      const { brandId, content, platforms } = req.body;
      if (!brandId || !content || !platforms) {
        return res.status(400).json({ error: 'brandId, content, and platforms required' });
      }

      const runId = generateRunId();
      const asyncRun: AsyncRun = {
        id: runId,
        status: 'running',
        pipelineId: 'content-repurpose',
        brandId,
        startedAt: new Date().toISOString(),
      };
      asyncRuns.set(runId, asyncRun);

      // Return immediately with run ID
      res.json({ runId, status: 'running', message: 'Content repurpose started. Poll GET /api/runs/:id for results.' });

      // Execute async
      orchestrator.repurposeContent(brandId, content, platforms)
        .then(result => {
          asyncRun.status = 'completed';
          asyncRun.completedAt = new Date().toISOString();
          asyncRun.result = result;
        })
        .catch(err => {
          asyncRun.status = 'failed';
          asyncRun.completedAt = new Date().toISOString();
          asyncRun.error = err instanceof Error ? err.message : 'Unknown error';
        });
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

      const runId = generateRunId();
      const asyncRun: AsyncRun = {
        id: runId,
        status: 'running',
        pipelineId: 'seo-blog',
        brandId,
        startedAt: new Date().toISOString(),
      };
      asyncRuns.set(runId, asyncRun);

      res.json({ runId, status: 'running', message: 'Blog generation started. Poll GET /api/runs/:id for results.' });

      orchestrator.generateBlogPost(brandId, topic, keywords ?? [])
        .then(result => {
          asyncRun.status = 'completed';
          asyncRun.completedAt = new Date().toISOString();
          asyncRun.result = result;
        })
        .catch(err => {
          asyncRun.status = 'failed';
          asyncRun.completedAt = new Date().toISOString();
          asyncRun.error = err instanceof Error ? err.message : 'Unknown error';
        });
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

      const runId = generateRunId();
      const asyncRun: AsyncRun = {
        id: runId,
        status: 'running',
        pipelineId: 'social-calendar',
        brandId,
        startedAt: new Date().toISOString(),
      };
      asyncRuns.set(runId, asyncRun);

      res.json({ runId, status: 'running', message: 'Calendar generation started. Poll GET /api/runs/:id for results.' });

      orchestrator.generateSocialCalendar(brandId, days, themes ?? [])
        .then(result => {
          asyncRun.status = 'completed';
          asyncRun.completedAt = new Date().toISOString();
          asyncRun.result = result;
        })
        .catch(err => {
          asyncRun.status = 'failed';
          asyncRun.completedAt = new Date().toISOString();
          asyncRun.error = err instanceof Error ? err.message : 'Unknown error';
        });
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

  // ─── Runs (both engine runs and async API runs) ─────────

  app.get('/api/runs', (_req, res) => {
    // Combine engine runs with async runs
    const engineRuns = orchestrator.listRuns();
    const apiRuns = Array.from(asyncRuns.values()).map(ar => ({
      id: ar.id,
      pipelineId: ar.pipelineId,
      brandId: ar.brandId,
      status: ar.status,
      startedAt: ar.startedAt,
      completedAt: ar.completedAt,
      error: ar.error,
      ...(ar.result ? { result: ar.result } : {}),
    }));
    res.json([...engineRuns, ...apiRuns]);
  });

  app.get('/api/runs/:id', (req, res) => {
    // Check async runs first
    const asyncRun = asyncRuns.get(req.params.id);
    if (asyncRun) {
      return res.json({
        id: asyncRun.id,
        pipelineId: asyncRun.pipelineId,
        brandId: asyncRun.brandId,
        status: asyncRun.status,
        startedAt: asyncRun.startedAt,
        completedAt: asyncRun.completedAt,
        error: asyncRun.error,
        ...(asyncRun.result ? { result: asyncRun.result } : {}),
      });
    }

    // Check engine runs
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
    console.log(`   Health:    GET  /health`);
    console.log(`   Test LLM:  POST /api/test-llm`);
    console.log(`   Skills:    GET  /api/skills`);
    console.log(`   Usage:     GET  /api/usage`);
    console.log(`   Repurpose: POST /api/repurpose`);
    console.log(`   Blog:      POST /api/blog`);
    console.log(`   Calendar:  POST /api/calendar`);
    console.log(`   Run Poll:  GET  /api/runs/:id\n`);
  });

  return { app, server };
}
