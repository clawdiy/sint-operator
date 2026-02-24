/**
 * Build script using esbuild — transpiles TypeScript to JavaScript.
 * Unlike tsc, esbuild ignores type errors and just compiles.
 * This ensures dist/ always has valid JS even if types are messy.
 */

import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';
import { build } from 'esbuild';

const SRC = 'src';
const OUT = 'dist';
const EXCLUDE = ['src/ui']; // UI is built by vite

// Collect all .ts files (excluding UI and .d.ts)
function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (EXCLUDE.some(ex => full.startsWith(ex))) continue;
    if (statSync(full).isDirectory()) {
      collectFiles(full, files);
    } else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

const entryPoints = collectFiles(SRC);
console.log(`Building ${entryPoints.length} TypeScript files...`);

try {
  await build({
    entryPoints,
    outdir: OUT,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    sourcemap: true,
    outbase: SRC,
    // Don't bundle — keep individual files like tsc does
    bundle: false,
    // Preserve .js extensions in imports (NodeNext compat)
    // esbuild strips .js from imports by default in non-bundle mode — this is fine
    // because the output files are .js and Node resolves them
  });
  console.log(`✅ Built ${entryPoints.length} files to ${OUT}/`);
} catch (err) {
  console.error('❌ Build failed:', err.message);
  process.exit(1);
}
