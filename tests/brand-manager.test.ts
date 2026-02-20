/**
 * Brand Manager Test Suite
 * 
 * Tests brand creation, context building, and YAML loading.
 * No API keys required.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

import {
  loadBrands,
  saveBrand,
  createBrand,
  getBrand,
  listBrands,
  updateBrand,
  deleteBrand,
  buildBrandContext,
  getPlatformConfig,
} from '../src/core/brand/manager.js';
import type { BrandProfile } from '../src/core/types.js';

const TEST_BRANDS_DIR = join(import.meta.dirname ?? '.', '__test_brands__');

function setupTestBrands() {
  if (!existsSync(TEST_BRANDS_DIR)) {
    mkdirSync(TEST_BRANDS_DIR, { recursive: true });
  }

  const testBrand: BrandProfile = {
    id: 'yaml-brand',
    name: 'YAML Test Brand',
    voice: {
      tone: ['bold', 'direct'],
      style: 'minimalist',
      doNot: ['use filler words', 'be passive'],
      vocabulary: ['ship', 'build', 'scale'],
      examples: ['Ship fast. Learn faster.', 'We build what matters.'],
    },
    visual: {
      primaryColors: ['#1A1A1A', '#FF6600'],
      secondaryColors: ['#FFFFFF', '#E5E5E5'],
      fonts: ['JetBrains Mono', 'Inter'],
      watermark: true,
    },
    platforms: [
      { platform: 'twitter', handle: '@testbrand', enabled: true },
      { platform: 'linkedin', handle: 'test-brand-co', enabled: true },
      { platform: 'instagram', handle: '@testbrand', enabled: false },
    ],
    keywords: ['startup', 'saas', 'growth'],
    competitors: ['Competitor A', 'Competitor B'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  };

  writeFileSync(join(TEST_BRANDS_DIR, 'yaml-brand.yaml'), yaml.dump(testBrand));
}

function cleanupTestBrands() {
  if (existsSync(TEST_BRANDS_DIR)) {
    rmSync(TEST_BRANDS_DIR, { recursive: true, force: true });
  }
}

describe('Brand Manager', () => {
  beforeEach(() => {
    setupTestBrands();
  });

  afterEach(() => {
    cleanupTestBrands();
  });

  // ─── Brand Loading from YAML ─────────────────────────────

  describe('Brand Loading', () => {
    it('should load brands from YAML directory', () => {
      loadBrands(TEST_BRANDS_DIR);
      const brand = getBrand('yaml-brand');
      expect(brand).toBeDefined();
      expect(brand!.name).toBe('YAML Test Brand');
    });

    it('should load brand voice properties', () => {
      loadBrands(TEST_BRANDS_DIR);
      const brand = getBrand('yaml-brand')!;
      expect(brand.voice.tone).toContain('bold');
      expect(brand.voice.style).toBe('minimalist');
      expect(brand.voice.doNot).toContain('use filler words');
    });

    it('should load brand visual properties', () => {
      loadBrands(TEST_BRANDS_DIR);
      const brand = getBrand('yaml-brand')!;
      expect(brand.visual.primaryColors).toContain('#1A1A1A');
      expect(brand.visual.fonts).toContain('Inter');
      expect(brand.visual.watermark).toBe(true);
    });

    it('should handle missing directory gracefully', () => {
      expect(() => loadBrands(join(TEST_BRANDS_DIR, 'nonexistent_subdir'))).not.toThrow();
    });
  });

  // ─── Brand Creation ──────────────────────────────────────

  describe('Brand Creation', () => {
    it('should create a brand with auto-generated id', () => {
      const brand = createBrand({
        name: 'New Brand',
        voice: {
          tone: ['friendly'],
          style: 'conversational',
          doNot: [],
          vocabulary: [],
          examples: [],
        },
        visual: {
          primaryColors: ['#000'],
          secondaryColors: [],
          fonts: ['Arial'],
        },
        platforms: [],
        keywords: [],
        competitors: [],
      });

      expect(brand.id).toBeDefined();
      expect(brand.id.length).toBeGreaterThan(0);
      expect(brand.name).toBe('New Brand');
      expect(brand.createdAt).toBeDefined();
      expect(brand.updatedAt).toBeDefined();
    });

    it('should store the created brand in memory', () => {
      const brand = createBrand({
        name: 'Stored Brand',
        voice: { tone: [], style: '', doNot: [], vocabulary: [], examples: [] },
        visual: { primaryColors: [], secondaryColors: [], fonts: [] },
        platforms: [],
        keywords: [],
        competitors: [],
      });

      const retrieved = getBrand(brand.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.name).toBe('Stored Brand');
    });

    it('should save brand to YAML file', () => {
      const brand = createBrand({
        name: 'File Brand',
        voice: { tone: ['warm'], style: 'casual', doNot: [], vocabulary: [], examples: [] },
        visual: { primaryColors: ['#FFF'], secondaryColors: [], fonts: ['Georgia'] },
        platforms: [],
        keywords: ['test'],
        competitors: [],
      });

      saveBrand(brand, TEST_BRANDS_DIR);
      
      // Reload and verify
      loadBrands(TEST_BRANDS_DIR);
      const reloaded = getBrand(brand.id);
      expect(reloaded).toBeDefined();
      expect(reloaded!.name).toBe('File Brand');
    });
  });

  // ─── Brand Updates ───────────────────────────────────────

  describe('Brand Updates', () => {
    it('should update brand properties', () => {
      const brand = createBrand({
        name: 'Update Me',
        voice: { tone: ['old'], style: 'old', doNot: [], vocabulary: [], examples: [] },
        visual: { primaryColors: [], secondaryColors: [], fonts: [] },
        platforms: [],
        keywords: [],
        competitors: [],
      });

      const updated = updateBrand(brand.id, { name: 'Updated Brand' });
      expect(updated).toBeDefined();
      expect(updated!.name).toBe('Updated Brand');
      expect(updated!.id).toBe(brand.id); // ID should not change
      expect(updated!.createdAt).toBe(brand.createdAt); // createdAt preserved
    });

    it('should return undefined for non-existent brand update', () => {
      const result = updateBrand('non-existent-id', { name: 'test' });
      expect(result).toBeUndefined();
    });
  });

  // ─── Brand Deletion ──────────────────────────────────────

  describe('Brand Deletion', () => {
    it('should delete a brand', () => {
      const brand = createBrand({
        name: 'Delete Me',
        voice: { tone: [], style: '', doNot: [], vocabulary: [], examples: [] },
        visual: { primaryColors: [], secondaryColors: [], fonts: [] },
        platforms: [],
        keywords: [],
        competitors: [],
      });

      const deleted = deleteBrand(brand.id);
      expect(deleted).toBe(true);
      expect(getBrand(brand.id)).toBeUndefined();
    });

    it('should return false for non-existent brand deletion', () => {
      expect(deleteBrand('non-existent-id')).toBe(false);
    });
  });

  // ─── Brand Context Building ──────────────────────────────

  describe('Brand Context Building', () => {
    it('should build brand context string', () => {
      loadBrands(TEST_BRANDS_DIR);
      const brand = getBrand('yaml-brand')!;
      const context = buildBrandContext(brand);

      expect(context).toContain('YAML Test Brand');
      expect(context).toContain('bold');
      expect(context).toContain('minimalist');
      expect(context).toContain('use filler words');
      expect(context).toContain('ship');
      expect(context).toContain('Ship fast. Learn faster.');
      expect(context).toContain('startup');
      expect(context).toContain('Competitor A');
    });

    it('should include voice section', () => {
      loadBrands(TEST_BRANDS_DIR);
      const brand = getBrand('yaml-brand')!;
      const context = buildBrandContext(brand);

      expect(context).toContain('Voice & Tone');
      expect(context).toContain('Tone:');
      expect(context).toContain('Style:');
      expect(context).toContain('NEVER:');
    });

    it('should include example content', () => {
      loadBrands(TEST_BRANDS_DIR);
      const brand = getBrand('yaml-brand')!;
      const context = buildBrandContext(brand);

      expect(context).toContain('Example Content');
      expect(context).toContain('We build what matters.');
    });
  });

  // ─── Platform Config ────────────────────────────────────

  describe('Platform Config', () => {
    it('should get enabled platform config', () => {
      loadBrands(TEST_BRANDS_DIR);
      const brand = getBrand('yaml-brand')!;

      const twitter = getPlatformConfig(brand, 'twitter');
      expect(twitter).toBeDefined();
      expect(twitter!.handle).toBe('@testbrand');
      expect(twitter!.enabled).toBe(true);
    });

    it('should not return disabled platform config', () => {
      loadBrands(TEST_BRANDS_DIR);
      const brand = getBrand('yaml-brand')!;

      const instagram = getPlatformConfig(brand, 'instagram');
      expect(instagram).toBeUndefined();
    });

    it('should return undefined for missing platform', () => {
      loadBrands(TEST_BRANDS_DIR);
      const brand = getBrand('yaml-brand')!;

      const tiktok = getPlatformConfig(brand, 'tiktok');
      expect(tiktok).toBeUndefined();
    });
  });

  // ─── List Brands ─────────────────────────────────────────

  describe('List Brands', () => {
    it('should list all loaded brands', () => {
      loadBrands(TEST_BRANDS_DIR);
      const brands = listBrands();
      expect(brands.length).toBeGreaterThanOrEqual(1);
      expect(brands.some(b => b.id === 'yaml-brand')).toBe(true);
    });
  });
});
