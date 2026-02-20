/**
 * E2E Pipeline Tests
 *
 * Tests end-to-end pipeline execution in dry-run mode (no API key).
 * Validates: pipeline loading, skill resolution, input guards, orchestrator quick actions.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { Orchestrator } from '../src/orchestrator/index.js';
import { listPipelines, getPipeline } from '../src/core/pipeline/engine.js';
import { getSkill } from '../src/core/skills/registry.js';

let orchestrator: Orchestrator;

beforeAll(() => {
  orchestrator = new Orchestrator({
    dataDir: './data',
    configDir: './config',
    openaiApiKey: '',  // dry-run mode
    models: {
      complex: 'claude-opus-4-6',
      routine: 'claude-sonnet-4-5',
      fallback: 'kimi-k2.5',
    },
  });
});

describe('Pipeline Definitions', () => {
  it('loads pipeline YAMLs from config', () => {
    const pipelines = listPipelines();
    expect(pipelines.length).toBeGreaterThanOrEqual(3);
    const ids = pipelines.map(p => p.id);
    expect(ids).toContain('content-repurpose');
    expect(ids).toContain('seo-blog');
    expect(ids).toContain('social-calendar');
  });

  it('content-repurpose pipeline references existing skills', () => {
    const pipeline = getPipeline('content-repurpose');
    expect(pipeline).toBeDefined();
    for (const step of pipeline!.steps) {
      const skill = getSkill(step.skill);
      expect(skill).toBeDefined();
    }
  });

  it('seo-blog pipeline references existing skills', () => {
    const pipeline = getPipeline('seo-blog');
    expect(pipeline).toBeDefined();
    for (const step of pipeline!.steps) {
      const skill = getSkill(step.skill);
      expect(skill).toBeDefined();
    }
  });

  it('social-calendar pipeline references existing skills', () => {
    const pipeline = getPipeline('social-calendar');
    expect(pipeline).toBeDefined();
    for (const step of pipeline!.steps) {
      const skill = getSkill(step.skill);
      expect(skill).toBeDefined();
    }
  });
});

describe('Skill Registry', () => {
  it('has all 13 built-in skills registered', () => {
    const skills = orchestrator.listSkills();
    expect(skills.length).toBeGreaterThanOrEqual(13);
  });

  it('core skills are resolvable', () => {
    const coreSkills = [
      'asset-ingester', 'content-analyzer', 'content-repurpose',
      'seo-blog', 'social-calendar', 'platform-formatter',
    ];
    for (const id of coreSkills) {
      expect(getSkill(id)).toBeDefined();
    }
  });
});

describe('Orchestrator Quick Actions (dry-run)', () => {
  it('repurposeContent completes in dry-run mode', async () => {
    const run = await orchestrator.repurposeContent(
      'sint-brand',
      'This is a test article about AI marketing automation.',
      ['twitter', 'linkedin'],
    );
    expect(run.status).toBe('completed');
    expect(run.pipelineId).toBe('content-repurpose');
    expect(run.steps.length).toBe(1);
    expect(run.steps[0].status).toBe('completed');
  });

  it('generateBlogPost completes in dry-run mode', async () => {
    const run = await orchestrator.generateBlogPost(
      'sint-brand',
      'AI Marketing Automation in 2025',
      ['AI', 'marketing'],
    );
    expect(run.status).toBe('completed');
    expect(run.pipelineId).toBe('seo-blog');
    expect(run.steps.length).toBe(1);
    expect(run.steps[0].status).toBe('completed');
  });

  it('generateSocialCalendar completes in dry-run mode', async () => {
    const run = await orchestrator.generateSocialCalendar(
      'sint-brand',
      3,
      ['AI', 'marketing'],
    );
    expect(run.status).toBe('completed');
    expect(run.pipelineId).toBe('social-calendar');
    expect(run.steps.length).toBe(1);
    expect(run.steps[0].status).toBe('completed');
  });

  it('generateSocialCalendar accepts platforms parameter', async () => {
    const run = await orchestrator.generateSocialCalendar(
      'sint-brand',
      2,
      [],
      ['tiktok', 'instagram'],
    );
    expect(run.status).toBe('completed');
  });
});

describe('Error Handling', () => {
  it('fails gracefully for non-existent brand', async () => {
    await expect(
      orchestrator.repurposeContent('nonexistent-brand', 'test', ['twitter']),
    ).rejects.toThrow('Brand not found');
  });

  it('fails gracefully for non-existent pipeline', async () => {
    await expect(
      orchestrator.runPipeline('nonexistent-pipeline', 'sint-brand', {}),
    ).rejects.toThrow();
  });
});

describe('LLM Dry-Run Mode', () => {
  it('detects dry-run mode without API key', async () => {
    const result = await orchestrator.testLLM();
    expect(result.ok).toBe(true);
    expect(result.mode).toBe('dry-run');
  });
});
