/**
 * SINT Marketing Operator — Entry Point
 * 
 * Starts the orchestrator daemon and API server.
 */

import { resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Orchestrator } from './orchestrator/index.js';
import { createServer } from './api/server.js';

const DATA_DIR = resolve(process.env.SINT_DATA_DIR ?? './data');
const CONFIG_DIR = resolve(process.env.SINT_CONFIG_DIR ?? './config');
const PORT = parseInt(process.env.SINT_PORT ?? '18789', 10);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
const DEFAULT_MODEL = process.env.SINT_MODEL ?? 'gpt-4o';

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY is required. Set it in .env or environment.');
  process.exit(1);
}

// Ensure directories
for (const dir of [DATA_DIR, CONFIG_DIR, `${CONFIG_DIR}/pipelines`, `${CONFIG_DIR}/brands`]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

console.log(`
╔══════════════════════════════════════════════╗
║     SINT MARKETING OPERATOR v0.1.0          ║
║     "Upload one asset → dozens of outputs"  ║
╚══════════════════════════════════════════════╝
`);

const orchestrator = new Orchestrator({
  dataDir: DATA_DIR,
  configDir: CONFIG_DIR,
  openaiApiKey: OPENAI_API_KEY,
  openaiBaseUrl: OPENAI_BASE_URL,
  defaultModel: DEFAULT_MODEL,
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
