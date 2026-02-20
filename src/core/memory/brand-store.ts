/**
 * Brand Memory Store
 * 
 * Persistent memory per brand:
 * /memory/brands/<brand-id>/
 *   brand-profile.json
 *   color-palette.json
 *   typography.json
 *   voice-examples/
 *     linkedin-approved.md
 *     twitter-approved.md
 *   assets/
 *     logo-primary.svg
 *   history/
 *     2026-02-content-calendar.csv
 * 
 * Vector index: approved content samples embedded for semantic search.
 * FTS5 index: guidelines, keywords, structured data for precise lookup.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { BrandProfile, MemoryService, Logger } from '../types.js';

export interface BrandMemoryEntry {
  id: string;
  brandId: string;
  type: 'approved_content' | 'guideline' | 'asset_ref' | 'history';
  platform?: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export class BrandMemoryStore {
  private baseDir: string;
  private memory: MemoryService;
  private logger: Logger;

  constructor(baseDir: string, memory: MemoryService, logger: Logger) {
    this.baseDir = baseDir;
    this.memory = memory;
    this.logger = logger;

    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }
  }

  // ─── Brand Directory Management ─────────────────────────

  private getBrandDir(brandId: string): string {
    const dir = join(this.baseDir, brandId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      // Create subdirectories
      for (const sub of ['voice-examples', 'assets', 'history']) {
        mkdirSync(join(dir, sub), { recursive: true });
      }
    }
    return dir;
  }

  // ─── Store Brand Profile ────────────────────────────────

  async storeBrandProfile(brand: BrandProfile): Promise<void> {
    const dir = this.getBrandDir(brand.id);
    writeFileSync(join(dir, 'brand-profile.json'), JSON.stringify(brand, null, 2));

    // Index brand guidelines in memory for semantic search
    await this.memory.store(
      `brand:${brand.id}:guidelines`,
      'voice-style',
      `Brand voice: ${brand.voice.style}. Tone: ${brand.voice.tone.join(', ')}. Never: ${brand.voice.doNot.join(', ')}`,
      { type: 'guideline', brandId: brand.id }
    );

    // Index keywords
    await this.memory.store(
      `brand:${brand.id}:guidelines`,
      'keywords',
      `Target keywords: ${brand.keywords.join(', ')}. Competitors: ${brand.competitors.join(', ')}`,
      { type: 'guideline', brandId: brand.id }
    );

    this.logger.info(`Brand profile stored: ${brand.name}`, { brandId: brand.id });
  }

  // ─── Approved Content Samples ───────────────────────────

  /**
   * Store an approved content sample for voice consistency.
   * These are embedded in ChromaDB for semantic retrieval.
   */
  async storeApprovedContent(
    brandId: string,
    platform: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const dir = this.getBrandDir(brandId);
    const examplesDir = join(dir, 'voice-examples');

    // Append to platform file
    const filePath = join(examplesDir, `${platform}-approved.md`);
    const existing = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';
    const entry = `\n---\n_Added: ${new Date().toISOString()}_\n\n${content}\n`;
    writeFileSync(filePath, existing + entry);

    // Index in semantic memory
    const id = `approved-${platform}-${Date.now()}`;
    await this.memory.store(
      `brand:${brandId}:approved`,
      id,
      content,
      { platform, brandId, ...metadata }
    );

    this.logger.info(`Approved content stored for ${platform}`, { brandId, contentLength: content.length });
  }

  /**
   * Retrieve similar approved content for voice consistency.
   * Returns the 5 most similar approved pieces to guide generation.
   */
  async getSimilarApproved(
    brandId: string,
    query: string,
    limit: number = 5
  ): Promise<Array<{ content: string; platform: string; score: number }>> {
    const results = await this.memory.search(`brand:${brandId}:approved`, query, limit);
    return results.map(r => ({
      content: r.text,
      platform: (r.metadata.platform as string) ?? 'unknown',
      score: r.score,
    }));
  }

  // ─── Asset Management ───────────────────────────────────

  storeAssetRef(brandId: string, assetType: string, filePath: string, metadata?: Record<string, unknown>): void {
    const dir = this.getBrandDir(brandId);
    const assetsFile = join(dir, 'assets.json');

    let assets: Record<string, unknown>[] = [];
    if (existsSync(assetsFile)) {
      try {
        assets = JSON.parse(readFileSync(assetsFile, 'utf-8'));
      } catch { /* start fresh */ }
    }

    assets.push({
      type: assetType,
      path: filePath,
      addedAt: new Date().toISOString(),
      ...metadata,
    });

    writeFileSync(assetsFile, JSON.stringify(assets, null, 2));
  }

  // ─── History Tracking ───────────────────────────────────

  async logGeneration(
    brandId: string,
    pipelineId: string,
    outputs: Array<{ platform: string; format: string; preview: string }>
  ): Promise<void> {
    const dir = this.getBrandDir(brandId);
    const historyDir = join(dir, 'history');

    const date = new Date().toISOString().split('T')[0];
    const logFile = join(historyDir, `${date}-generations.jsonl`);

    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      pipeline: pipelineId,
      outputs: outputs.map(o => ({ platform: o.platform, format: o.format, preview: o.preview.slice(0, 200) })),
    });

    const existing = existsSync(logFile) ? readFileSync(logFile, 'utf-8') : '';
    writeFileSync(logFile, existing + entry + '\n');
  }

  // ─── Visual Identity ───────────────────────────────────

  storeColorPalette(brandId: string, palette: Record<string, unknown>): void {
    const dir = this.getBrandDir(brandId);
    writeFileSync(join(dir, 'color-palette.json'), JSON.stringify(palette, null, 2));
  }

  storeTypography(brandId: string, typography: Record<string, unknown>): void {
    const dir = this.getBrandDir(brandId);
    writeFileSync(join(dir, 'typography.json'), JSON.stringify(typography, null, 2));
  }

  getColorPalette(brandId: string): Record<string, unknown> | null {
    const path = join(this.getBrandDir(brandId), 'color-palette.json');
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  }

  getTypography(brandId: string): Record<string, unknown> | null {
    const path = join(this.getBrandDir(brandId), 'typography.json');
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  }
}
