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
import type { BrandProfile, PlatformConfig } from '../types.js';

const brands = new Map<string, BrandProfile>();

type CreateBrandData = Omit<BrandProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

function normalizeBrand(raw: unknown): BrandProfile | null {
  if (!raw || typeof raw !== 'object') return null;

  const candidate = raw as Partial<BrandProfile>;
  if (!candidate.id || typeof candidate.id !== 'string') {
    return null;
  }

  const now = new Date().toISOString();

  return {
    ...(candidate as BrandProfile),
    userId: typeof candidate.userId === 'string' && candidate.userId.trim().length > 0
      ? candidate.userId.trim()
      : 'legacy',
    createdAt: typeof candidate.createdAt === 'string' && candidate.createdAt.length > 0
      ? candidate.createdAt
      : now,
    updatedAt: typeof candidate.updatedAt === 'string' && candidate.updatedAt.length > 0
      ? candidate.updatedAt
      : now,
  };
}

function parseCreateArgs(userIdOrData: string | CreateBrandData, maybeData?: CreateBrandData): { userId: string; data: CreateBrandData } {
  if (typeof userIdOrData === 'string') {
    if (!maybeData) {
      throw new Error('Brand payload is required');
    }
    return { userId: userIdOrData, data: maybeData };
  }

  return { userId: 'legacy', data: userIdOrData };
}

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
      const brand = normalizeBrand(yaml.load(raw));
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

  const normalized: BrandProfile = {
    ...brand,
    userId: brand.userId || 'legacy',
  };

  const path = join(dir, `${normalized.id}.yaml`);
  writeFileSync(path, yaml.dump(normalized, { lineWidth: 120 }));
  brands.set(normalized.id, normalized);
}

// ─── CRUD ─────────────────────────────────────────────────────

export function createBrand(userId: string, data: CreateBrandData): BrandProfile;
export function createBrand(data: CreateBrandData): BrandProfile;
export function createBrand(userIdOrData: string | CreateBrandData, maybeData?: CreateBrandData): BrandProfile {
  const { userId, data } = parseCreateArgs(userIdOrData, maybeData);
  const now = new Date().toISOString();

  const brand: BrandProfile = {
    id: nanoid(12),
    userId,
    createdAt: now,
    updatedAt: now,
    ...data,
  };

  brands.set(brand.id, brand);
  return brand;
}

export function getBrand(id: string, userId?: string): BrandProfile | undefined {
  const brand = brands.get(id);
  if (!brand) return undefined;
  if (userId && brand.userId !== userId) return undefined;
  return brand;
}

export function listBrands(userId?: string): BrandProfile[] {
  const all = Array.from(brands.values());
  if (!userId) return all;
  return all.filter(brand => brand.userId === userId);
}

export function updateBrand(id: string, userId: string, updates: Partial<BrandProfile>): BrandProfile | undefined;
export function updateBrand(id: string, updates: Partial<BrandProfile>): BrandProfile | undefined;
export function updateBrand(
  id: string,
  userIdOrUpdates: string | Partial<BrandProfile>,
  maybeUpdates?: Partial<BrandProfile>,
): BrandProfile | undefined {
  const existing = brands.get(id);
  if (!existing) return undefined;

  const userId = typeof userIdOrUpdates === 'string' ? userIdOrUpdates : undefined;
  const updates = typeof userIdOrUpdates === 'string' ? (maybeUpdates ?? {}) : userIdOrUpdates;

  if (userId && existing.userId !== userId) {
    return undefined;
  }

  const updated: BrandProfile = {
    ...existing,
    ...updates,
    id: existing.id,
    userId: existing.userId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  brands.set(id, updated);
  return updated;
}

export function deleteBrand(id: string, userId?: string): boolean {
  const existing = brands.get(id);
  if (!existing) return false;
  if (userId && existing.userId !== userId) return false;
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
