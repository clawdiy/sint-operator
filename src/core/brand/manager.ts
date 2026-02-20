/**
 * Brand Context Manager
 * 
 * Loads, stores, and injects brand profiles into every generation.
 * Ensures voice, style, and visual consistency across all outputs.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { nanoid } from 'nanoid';
import type { BrandProfile, BrandVoice, BrandVisual, PlatformConfig } from '../types.js';

const brands = new Map<string, BrandProfile>();

// ─── Load / Save ──────────────────────────────────────────────

export function loadBrands(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    return;
  }

  const files = readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  for (const file of files) {
    try {
      const raw = readFileSync(join(dir, file), 'utf-8');
      const brand = yaml.load(raw) as BrandProfile;
      if (brand?.id) {
        brands.set(brand.id, brand);
      }
    } catch {
      // Skip malformed brand files
    }
  }
}

export function saveBrand(brand: BrandProfile, dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const path = join(dir, `${brand.id}.yaml`);
  writeFileSync(path, yaml.dump(brand, { lineWidth: 120 }));
  brands.set(brand.id, brand);
}

// ─── CRUD ─────────────────────────────────────────────────────

export function createBrand(data: Omit<BrandProfile, 'id' | 'createdAt' | 'updatedAt'>): BrandProfile {
  const now = new Date().toISOString();
  const brand: BrandProfile = {
    id: nanoid(12),
    createdAt: now,
    updatedAt: now,
    ...data,
  };
  brands.set(brand.id, brand);
  return brand;
}

export function getBrand(id: string): BrandProfile | undefined {
  return brands.get(id);
}

export function listBrands(): BrandProfile[] {
  return Array.from(brands.values());
}

export function updateBrand(id: string, updates: Partial<BrandProfile>): BrandProfile | undefined {
  const existing = brands.get(id);
  if (!existing) return undefined;

  const updated: BrandProfile = {
    ...existing,
    ...updates,
    id: existing.id,  // prevent id override
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  brands.set(id, updated);
  return updated;
}

export function deleteBrand(id: string): boolean {
  return brands.delete(id);
}

// ─── Brand Context Injection ──────────────────────────────────

/**
 * Generates a system prompt fragment that injects brand context
 * into any LLM call. This ensures every generation follows
 * the brand's voice, tone, and constraints.
 */
export function buildBrandContext(brand: BrandProfile): string {
  const sections: string[] = [];

  sections.push(`# Brand: ${brand.name}`);

  // Voice
  if (brand.voice) {
    sections.push(`\n## Voice & Tone`);
    if (brand.voice.tone.length > 0) {
      sections.push(`Tone: ${brand.voice.tone.join(', ')}`);
    }
    if (brand.voice.style) {
      sections.push(`Style: ${brand.voice.style}`);
    }
    if (brand.voice.doNot.length > 0) {
      sections.push(`\nNEVER:`);
      brand.voice.doNot.forEach(d => sections.push(`- ${d}`));
    }
    if (brand.voice.vocabulary.length > 0) {
      sections.push(`\nPreferred terms: ${brand.voice.vocabulary.join(', ')}`);
    }
    if (brand.voice.examples.length > 0) {
      sections.push(`\n## Example Content (match this style):`);
      brand.voice.examples.forEach((ex, i) => sections.push(`${i + 1}. "${ex}"`));
    }
  }

  // Keywords
  if (brand.keywords.length > 0) {
    sections.push(`\n## Target Keywords: ${brand.keywords.join(', ')}`);
  }

  // Competitors
  if (brand.competitors.length > 0) {
    sections.push(`\n## Competitors (differentiate from): ${brand.competitors.join(', ')}`);
  }

  return sections.join('\n');
}

/**
 * Returns platform-specific constraints for content generation.
 */
export function getPlatformConfig(brand: BrandProfile, platform: string): PlatformConfig | undefined {
  return brand.platforms.find(p => p.platform === platform && p.enabled);
}
