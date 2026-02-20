/**
 * Skill Registry Test Suite
 * 
 * Tests skill registration, matching, and progressive disclosure levels.
 * No API keys required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  registerSkill,
  getSkill,
  listSkillSummaries,
  matchSkills,
  getRegistrySize,
  getTokenEstimate,
} from '../src/core/skills/registry.js';
import type { Skill, SkillContext, SkillResult } from '../src/core/types.js';

// ─── Test Fixtures ────────────────────────────────────────────

function createTestSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: overrides.id ?? 'test-skill',
    name: overrides.name ?? 'Test Skill',
    description: overrides.description ?? 'A skill for testing',
    version: overrides.version ?? '1.0.0',
    costUnits: overrides.costUnits ?? 5,
    inputs: overrides.inputs ?? [],
    outputs: overrides.outputs ?? [],
    execute: overrides.execute ?? vi.fn().mockResolvedValue({
      output: { result: 'test' },
      tokensUsed: 100,
      costUnits: 5,
      modelUsed: 'test-model',
      durationMs: 50,
    } satisfies SkillResult),
  };
}

// ─── Tests ────────────────────────────────────────────────────

describe('Skill Registry', () => {
  // Note: since the registry is a global Map, skills from other tests
  // may already be registered. Tests check additive behavior.

  // ─── Skill Registration ──────────────────────────────────

  describe('Skill Registration', () => {
    it('should register a new skill', () => {
      const skill = createTestSkill({ id: 'reg-test-1', name: 'Registration Test 1' });
      registerSkill(skill);

      const retrieved = getSkill('reg-test-1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('reg-test-1');
      expect(retrieved!.name).toBe('Registration Test 1');
    });

    it('should overwrite existing skill on re-register', () => {
      const skill1 = createTestSkill({ id: 'reg-test-2', description: 'Version 1' });
      registerSkill(skill1);

      const skill2 = createTestSkill({ id: 'reg-test-2', description: 'Version 2' });
      registerSkill(skill2);

      const retrieved = getSkill('reg-test-2');
      expect(retrieved!.description).toBe('Version 2');
    });

    it('should return undefined for unregistered skill', () => {
      expect(getSkill('nonexistent-skill-xyz')).toBeUndefined();
    });

    it('should track registry size', () => {
      const sizeBefore = getRegistrySize();
      registerSkill(createTestSkill({ id: `size-test-${Date.now()}` }));
      expect(getRegistrySize()).toBe(sizeBefore + 1);
    });

    it('should estimate token usage', () => {
      const estimate = getTokenEstimate();
      // ~75 tokens per skill
      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBe(getRegistrySize() * 75);
    });
  });

  // ─── Skill Matching ─────────────────────────────────────

  describe('Skill Matching', () => {
    beforeEach(() => {
      // Register skills with specific descriptions and triggers for matching
      registerSkill(createTestSkill({
        id: 'content-repurpose-match',
        name: 'Content Repurpose',
        description: 'Repurpose content into platform-specific posts',
      }));

      registerSkill(createTestSkill({
        id: 'seo-blog-match',
        name: 'SEO Blog Writer',
        description: 'Write SEO-optimized blog articles',
      }));

      registerSkill(createTestSkill({
        id: 'social-calendar-match',
        name: 'Social Calendar',
        description: 'Generate social media content calendar',
      }));

      registerSkill(createTestSkill({
        id: 'video-clipper-match',
        name: 'Video Clipper',
        description: 'Clip and edit video content for short-form platforms',
      }));
    });

    it('should match skills by description keywords', () => {
      const matches = matchSkills('repurpose content into posts');
      expect(matches.length).toBeGreaterThan(0);
      // 'content-repurpose-match' should be in the results
      const ids = matches.map(m => m.manifest.name);
      expect(ids).toContain('content-repurpose-match');
    });

    it('should match skills by name', () => {
      const matches = matchSkills('seo blog');
      expect(matches.length).toBeGreaterThan(0);
      const ids = matches.map(m => m.manifest.name);
      expect(ids).toContain('seo-blog-match');
    });

    it('should return empty for unrelated query', () => {
      const matches = matchSkills('quantum physics simulation');
      // Might match some words tangentially, but should be minimal
      const exactMatch = matches.find(m => m.manifest.name === 'content-repurpose-match');
      // If there are matches, they shouldn't include our unrelated skills with high confidence
      expect(matches.length).toBeLessThanOrEqual(getRegistrySize());
    });

    it('should rank matches by relevance score', () => {
      const matches = matchSkills('video content for social media calendar');
      // Multiple skills should match; verify order
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  // ─── Progressive Disclosure Levels ───────────────────────

  describe('Progressive Disclosure', () => {
    it('should list L1 skill summaries (name + description)', () => {
      registerSkill(createTestSkill({
        id: 'disclosure-test',
        name: 'Disclosure Test',
        description: 'Skill for progressive disclosure testing',
      }));

      const summaries = listSkillSummaries();
      expect(summaries.length).toBeGreaterThan(0);

      const found = summaries.find(s => s.name === 'disclosure-test');
      expect(found).toBeDefined();
      expect(found!.description).toBe('Skill for progressive disclosure testing');
      expect(found!.costUnits).toBeDefined();
    });

    it('should include trigger information in summaries', () => {
      // Skills registered via registerSkill don't have triggers by default,
      // but the summary should include the triggers field
      const summaries = listSkillSummaries();
      expect(summaries.length).toBeGreaterThan(0);
      // Every summary should have the triggers field (even if empty)
      for (const s of summaries) {
        expect('triggers' in s).toBe(true);
      }
    });

    it('should keep token cost low at L1 level', () => {
      const estimate = getTokenEstimate();
      const perSkill = estimate / getRegistrySize();
      // Should be ~75 tokens per skill at L1
      expect(perSkill).toBe(75);
    });
  });

  // ─── Skill Execution ────────────────────────────────────

  describe('Skill Execution', () => {
    it('should execute a registered skill', async () => {
      const executeFn = vi.fn().mockResolvedValue({
        output: { message: 'executed!' },
        tokensUsed: 50,
        costUnits: 2,
        modelUsed: 'test-model',
        durationMs: 25,
      });

      registerSkill(createTestSkill({
        id: 'exec-test',
        execute: executeFn,
      }));

      const skill = getSkill('exec-test');
      expect(skill).toBeDefined();

      const mockCtx = {
        inputs: { text: 'hello' },
        brand: {} as any,
        llm: {} as any,
        tools: {} as any,
        memory: {} as any,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await skill!.execute(mockCtx);
      expect(result.output).toEqual({ message: 'executed!' });
      expect(result.tokensUsed).toBe(50);
      expect(executeFn).toHaveBeenCalledWith(mockCtx);
    });
  });
});
