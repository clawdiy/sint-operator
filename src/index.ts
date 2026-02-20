/**
 * SINT Marketing Operator v0.2.0 — Entry Point
 * 
 * Intelligent model routing, progressive skill disclosure,
 * metering with hard stops, and audit trail.
 */

import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Orchestrator } from './orchestrator/index.js';
import { createServer } from './api/server.js';
import type { ModelConfig } from './core/types.js';

const DATA_DIR = resolve(process.env.SINT_DATA_DIR ?? './data');
const CONFIG_DIR = resolve(process.env.SINT_CONFIG_DIR ?? './config');
const PORT = parseInt(process.env.PORT ?? process.env.SINT_PORT ?? '18789', 10);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;

// Model routing configuration
const MODELS: ModelConfig = {
  complex: process.env.SINT_MODEL_COMPLEX ?? 'claude-opus-4-6',
  routine: process.env.SINT_MODEL_ROUTINE ?? 'claude-sonnet-4-5',
  fallback: process.env.SINT_MODEL_FALLBACK ?? 'kimi-k2.5',
};

if (!OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY not set. API will load but LLM calls will fail.');
  console.warn('   Set OPENAI_API_KEY in environment variables to enable AI features.');
}

// Ensure directories
for (const dir of [
  DATA_DIR, CONFIG_DIR,
  `${CONFIG_DIR}/pipelines`, `${CONFIG_DIR}/brands`, `${CONFIG_DIR}/skills`,
  `${DATA_DIR}/assets`, `${DATA_DIR}/outputs`, `${DATA_DIR}/logs`,
]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

console.log(`
╔══════════════════════════════════════════════════╗
║     SINT MARKETING OPERATOR v0.2.0              ║
║     "No prompts. Just outcomes."                ║
╠══════════════════════════════════════════════════╣
║  Models:                                        ║
║    Complex:  ${MODELS.complex.padEnd(35)}║
║    Routine:  ${MODELS.routine.padEnd(35)}║
║    Fallback: ${MODELS.fallback.padEnd(35)}║
╚══════════════════════════════════════════════════╝
`);

const orchestrator = new Orchestrator({
  dataDir: DATA_DIR,
  configDir: CONFIG_DIR,
  openaiApiKey: OPENAI_API_KEY,
  openaiBaseUrl: OPENAI_BASE_URL,
  models: MODELS,
});

const { server } = createServer(orchestrator, PORT);

// Graceful shutdown
const shutdown = () => {
  console.log('\n🛑 Shutting down...');
  orchestrator.shutdown();
  server.close(() => {
    console.log('✅ Shutdown complete');
    process.exit(0);
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
