/**
 * SINT Marketing Operator v0.5.0 — Entry Point
 * 
 * Intelligent model routing, progressive skill disclosure,
 * metering with hard stops, and audit trail.
 */

import dotenv from 'dotenv';
// Load .env — override only empty-string env vars (e.g. ANTHROPIC_API_KEY='' in shell)
const _dotenvResult = dotenv.config();
if (_dotenvResult.parsed) {
  for (const [k, v] of Object.entries(_dotenvResult.parsed)) {
    if (process.env[k] === '' || process.env[k] === undefined) process.env[k] = v;
  }
}

import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Orchestrator } from './orchestrator/index.js';
import { createServer } from './api/server.js';
import type { ModelConfig } from './core/types.js';
import { logger } from './api/logger.js';

const DATA_DIR = resolve(process.env.SINT_DATA_DIR ?? './data');
const CONFIG_DIR = resolve(process.env.SINT_CONFIG_DIR ?? './config');
const PORT = parseInt(process.env.PORT ?? process.env.SINT_PORT ?? '18789', 10);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? '';

// Model routing configuration
const MODELS: ModelConfig = {
  complex: process.env.SINT_MODEL_COMPLEX ?? 'o3',
  routine: process.env.SINT_MODEL_ROUTINE ?? 'gpt-4.1-mini',
  fallback: process.env.SINT_MODEL_FALLBACK ?? 'gpt-4.1-nano',
};

if (!OPENAI_API_KEY && !ANTHROPIC_API_KEY) {
  console.warn('⚠️  No API keys set. LLM calls will run in dry-run mode.');
  console.warn('   Set OPENAI_API_KEY and/or ANTHROPIC_API_KEY to enable AI features.');
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
║     SINT MARKETING OPERATOR v0.5.0              ║
║     "No prompts. Just outcomes."                ║
╠══════════════════════════════════════════════════╣
║  Models:                                        ║
║    Complex:  ${MODELS.complex.padEnd(35)}║
║    Routine:  ${MODELS.routine.padEnd(35)}║
║    Fallback: ${MODELS.fallback.padEnd(35)}║
║  API Keys:                                      ║
║    OpenAI:    ${(OPENAI_API_KEY ? '✅ configured' : '❌ not set').padEnd(35)}║
║    Anthropic: ${(ANTHROPIC_API_KEY ? '✅ configured' : '❌ not set').padEnd(35)}║
╚══════════════════════════════════════════════════╝
`);

const orchestrator = new Orchestrator({
  dataDir: DATA_DIR,
  configDir: CONFIG_DIR,
  openaiApiKey: OPENAI_API_KEY,
  anthropicApiKey: ANTHROPIC_API_KEY,
  openaiBaseUrl: OPENAI_BASE_URL,
  models: MODELS,
});

const { server } = createServer(orchestrator, PORT, {
  dataDir: DATA_DIR,
  configDir: CONFIG_DIR,
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  orchestrator.shutdown();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received');
  orchestrator.shutdown();
  server.close(() => process.exit(0));
});
