/**
 * Pipeline Engine Test Suite
 * 
 * Tests pipeline loading, variable resolution, condition evaluation,
 * retry logic, and parallel execution — all without API keys.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

// Import the engine functions directly
import {
  loadPipelines,
  listPipelines,
  getPipeline,
  executePipeline,
  matchPipeline,
  matchAllPipelines,
  resolveInputs,
  resolveValue,
  evaluateCondition,
} from '../src/core/pipeline/engine.js';
import { registerSkill, getSkill } from '../src/core/skills/registry.js';
import type {
  PipelineDefinition,
  BrandProfile,
  Skill,
  SkillContext,
  SkillResult,
  LLMRouter,
  ToolServices,
  MemoryService,
  Logger,
} from '../src/core/types.js';

// ─── Test Fixtures ────────────────────────────────────────────

const TEST_PIPELINES_DIR = join(import.meta.dirname ?? '.', '__test_pipelines__');

const mockBrand: BrandProfile = {
  id: 'test-brand',
  name: 'Test Brand',
  voice: {
    tone: ['professional', 'friendly'],
    style: 'casual',
    doNot: ['use jargon'],
    vocabulary: ['awesome', 'great'],
    examples: ['Great things happen here.'],
  },
  visual: {
    primaryColors: ['#FF0000'],
    secondaryColors: ['#0000FF'],
    fonts: ['Inter'],
  },
  platforms: [],
  keywords: ['test', 'quality'],
  competitors: ['OtherBrand'],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockMemory: MemoryService = {
  store: vi.fn().mockResolvedValue(undefined),
  search: vi.fn().mockResolvedValue([]),
  get: vi.fn().mockResolvedValue(null),
  delete: vi.fn().mockResolvedValue(undefined),
};

const mockLLM: LLMRouter = {
  complete: vi.fn().mockResolvedValue({ text: 'mock response', meta: { model: 'mock', tier: 'routine' as const, inputTokens: 10, outputTokens: 20, totalTokens: 30, costUnits: 1, durationMs: 100 } }),
  completeJSON: vi.fn().mockResolvedValue({ data: {}, meta: { model: 'mock', tier: 'routine' as const, inputTokens: 10, outputTokens: 20, totalTokens: 30, costUnits: 1, durationMs: 100 } }),
  embedText: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  routeModel: vi.fn().mockReturnValue({ tier: 'routine' as const, model: 'mock-model', reason: 'test' }),
};

const mockTools: ToolServices = {
  ffmpeg: {} as any,
  sharp: {} as any,
  browser: {} as any,
  whisper: {} as any,
};

function createMockSkill(id: string, output: Record<string, unknown> = { result: 'ok' }): Skill {
  return {
    id,
    name: id,
    description: `Mock skill: ${id}`,
    version: '1.0.0',
    costUnits: 5,
    inputs: [],
    outputs: [],
    execute: vi.fn().mockResolvedValue({
      output,
      tokensUsed: 100,
      costUnits: 5,
      modelUsed: 'mock-model',
      durationMs: 50,
    } satisfies SkillResult),
  };
}

function createFailingSkill(id: string, failCount: number): Skill {
  let attempts = 0;
  return {
    id,
    name: id,
    description: `Failing skill: ${id}`,
    version: '1.0.0',
    costUnits: 5,
    inputs: [],
    outputs: [],
    execute: vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts <= failCount) {
        throw new Error(`Intentional failure #${attempts}`);
      }
      return {
        output: { result: 'recovered' },
        tokensUsed: 100,
        costUnits: 5,
        modelUsed: 'mock-model',
        durationMs: 50,
      } satisfies SkillResult;
    }),
  };
}

// ─── Test Setup/Teardown ──────────────────────────────────────

function setupTestPipelines() {
  if (!existsSync(TEST_PIPELINES_DIR)) {
    mkdirSync(TEST_PIPELINES_DIR, { recursive: true });
  }

  const simplePipeline: PipelineDefinition = {
    id: 'test-simple',
    name: 'Simple Test Pipeline',
    description: 'A simple test pipeline',
    version: '1.0',
    trigger: { type: 'manual', pattern: 'run simple|test simple' },
    inputs: [{ name: 'text', type: 'string', required: true }],
    steps: [
      {
        id: 'step1',
        skill: 'mock-skill-a',
        action: 'Process text',
        inputs: { text: '${inputs.text}' },
        output: 'processed',
      },
    ],
    outputs: [],
  };

  const chainedPipeline: PipelineDefinition = {
    id: 'test-chained',
    name: 'Chained Test Pipeline',
    description: 'A pipeline with step chaining',
    version: '1.0',
    trigger: { type: 'manual', pattern: 'chain|multi-step' },
    inputs: [{ name: 'text', type: 'string', required: true }],
    steps: [
      {
        id: 'step1',
        skill: 'mock-skill-a',
        action: 'First step',
        inputs: { text: '${inputs.text}' },
        output: 'first_result',
      },
      {
        id: 'step2',
        skill: 'mock-skill-b',
        action: 'Second step using first output',
        inputs: { data: '$first_result' },
        output: 'second_result',
      },
    ],
    outputs: [],
  };

  const conditionalPipeline: PipelineDefinition = {
    id: 'test-conditional',
    name: 'Conditional Test Pipeline',
    description: 'A pipeline with conditions',
    version: '1.0',
    trigger: { type: 'manual', pattern: 'conditional|if-else' },
    inputs: [
      { name: 'text', type: 'string', required: true },
      { name: 'skip_second', type: 'boolean', default: false },
    ],
    steps: [
      {
        id: 'step1',
        skill: 'mock-skill-a',
        action: 'Always runs',
        inputs: { text: '${inputs.text}' },
        output: 'first',
      },
      {
        id: 'step2',
        skill: 'mock-skill-b',
        condition: '!ctx["inputs.skip_second"]',
        action: 'Conditional step',
        inputs: { data: '$first' },
        output: 'second',
      },
    ],
    outputs: [],
  };

  const retryPipeline: PipelineDefinition = {
    id: 'test-retry',
    name: 'Retry Test Pipeline',
    description: 'A pipeline with retry logic',
    version: '1.0',
    trigger: { type: 'manual', pattern: 'retry|resilient' },
    inputs: [{ name: 'text', type: 'string', required: true }],
    steps: [
      {
        id: 'step1',
        skill: 'mock-skill-retry',
        action: 'Retryable step',
        inputs: { text: '${inputs.text}' },
        retry: { max: 3, backoff: 'linear' },
        output: 'result',
      },
    ],
    outputs: [],
  };

  const parallelPipeline: PipelineDefinition = {
    id: 'test-parallel',
    name: 'Parallel Test Pipeline',
    description: 'A pipeline with parallel execution',
    version: '1.0',
    trigger: { type: 'manual', pattern: 'parallel|concurrent' },
    inputs: [{ name: 'text', type: 'string', required: true }],
    steps: [
      {
        id: 'step1',
        skill: 'mock-skill-a',
        action: 'Parallel step',
        inputs: { text: '${inputs.text}' },
        config: { parallel: true, count: 3 },
        output: 'parallel_results',
      },
    ],
    outputs: [],
  };

  const triggerMatchPipeline: PipelineDefinition = {
    id: 'test-trigger-seo',
    name: 'SEO Blog Pipeline',
    description: 'Trigger test for SEO',
    version: '1.0',
    trigger: { type: 'manual', pattern: 'seo.*blog|write.*blog.*post|blog.*about' },
    inputs: [{ name: 'topic', type: 'string', required: true }],
    steps: [
      {
        id: 'step1',
        skill: 'mock-skill-a',
        action: 'Generate blog',
        inputs: { topic: '${inputs.topic}' },
        output: 'blog',
      },
    ],
    outputs: [],
  };

  // Write YAML files
  writeFileSync(join(TEST_PIPELINES_DIR, 'simple.yaml'), yaml.dump(simplePipeline));
  writeFileSync(join(TEST_PIPELINES_DIR, 'chained.yaml'), yaml.dump(chainedPipeline));
  writeFileSync(join(TEST_PIPELINES_DIR, 'conditional.yaml'), yaml.dump(conditionalPipeline));
  writeFileSync(join(TEST_PIPELINES_DIR, 'retry.yaml'), yaml.dump(retryPipeline));
  writeFileSync(join(TEST_PIPELINES_DIR, 'parallel.yaml'), yaml.dump(parallelPipeline));
  writeFileSync(join(TEST_PIPELINES_DIR, 'trigger-seo.yaml'), yaml.dump(triggerMatchPipeline));
}

function cleanupTestPipelines() {
  if (existsSync(TEST_PIPELINES_DIR)) {
    rmSync(TEST_PIPELINES_DIR, { recursive: true, force: true });
  }
}

// ─── Tests ────────────────────────────────────────────────────

describe('Pipeline Engine', () => {
  beforeEach(() => {
    setupTestPipelines();
    loadPipelines(TEST_PIPELINES_DIR);

    // Register mock skills
    registerSkill(createMockSkill('mock-skill-a', { result: 'from-a', text: 'hello' }));
    registerSkill(createMockSkill('mock-skill-b', { result: 'from-b', combined: true }));
  });

  afterEach(() => {
    cleanupTestPipelines();
  });

  // ─── Pipeline Loading ────────────────────────────────────

  describe('Pipeline Loading', () => {
    it('should load pipelines from YAML directory', () => {
      const all = listPipelines();
      expect(all.length).toBeGreaterThanOrEqual(6);
    });

    it('should retrieve a specific pipeline by ID', () => {
      const pipeline = getPipeline('test-simple');
      expect(pipeline).toBeDefined();
      expect(pipeline!.name).toBe('Simple Test Pipeline');
      expect(pipeline!.steps).toHaveLength(1);
    });

    it('should return undefined for non-existent pipeline', () => {
      expect(getPipeline('non-existent')).toBeUndefined();
    });

    it('should handle missing directory gracefully', () => {
      expect(() => loadPipelines('/nonexistent/dir')).not.toThrow();
    });
  });

  // ─── Variable Resolution ─────────────────────────────────

  describe('Variable Resolution', () => {
    it('should resolve $variable references', () => {
      const vars = new Map<string, unknown>();
      vars.set('$myVar', 'hello world');

      const result = resolveValue('$myVar', vars);
      expect(result).toBe('hello world');
    });

    it('should resolve ${inputs.x} templates', () => {
      const vars = new Map<string, unknown>();
      vars.set('inputs.text', 'test content');

      const result = resolveValue('${inputs.text}', vars);
      expect(result).toBe('test content');
    });

    it('should resolve inline template expressions', () => {
      const vars = new Map<string, unknown>();
      vars.set('inputs.name', 'World');

      const result = resolveValue('Hello ${inputs.name}!', vars);
      expect(result).toBe('Hello World!');
    });

    it('should resolve $ref objects', () => {
      const vars = new Map<string, unknown>();
      vars.set('$output', { data: 'test' });

      const result = resolveValue({ $ref: 'output' }, vars);
      expect(result).toEqual({ data: 'test' });
    });

    it('should keep unresolved templates intact', () => {
      const vars = new Map<string, unknown>();
      const result = resolveValue('${unknown.var}', vars);
      expect(result).toBe('${unknown.var}');
    });

    it('should resolve inputs map', () => {
      const vars = new Map<string, unknown>();
      vars.set('inputs.text', 'hello');
      vars.set('$prev', { data: 123 });

      const resolved = resolveInputs(
        { text: '${inputs.text}', prev: '$prev', literal: 'no change' },
        vars
      );

      expect(resolved.text).toBe('hello');
      expect(resolved.prev).toEqual({ data: 123 });
      expect(resolved.literal).toBe('no change');
    });

    it('should return non-string values unchanged', () => {
      const vars = new Map<string, unknown>();
      expect(resolveValue(42, vars)).toBe(42);
      expect(resolveValue(true, vars)).toBe(true);
      expect(resolveValue(null, vars)).toBe(null);
    });
  });

  // ─── Condition Evaluation ────────────────────────────────

  describe('Condition Evaluation', () => {
    it('should evaluate truthy conditions', () => {
      const vars = new Map<string, unknown>();
      vars.set('enabled', true);

      expect(evaluateCondition('ctx.enabled', vars)).toBe(true);
    });

    it('should evaluate falsy conditions', () => {
      const vars = new Map<string, unknown>();
      vars.set('enabled', false);

      expect(evaluateCondition('ctx.enabled', vars)).toBe(false);
    });

    it('should handle invalid conditions gracefully', () => {
      const vars = new Map<string, unknown>();
      expect(evaluateCondition('invalid!!!syntax(((', vars)).toBe(false);
    });

    it('should evaluate comparison conditions', () => {
      const vars = new Map<string, unknown>();
      vars.set('count', 5);

      expect(evaluateCondition('ctx.count > 3', vars)).toBe(true);
      expect(evaluateCondition('ctx.count > 10', vars)).toBe(false);
    });
  });

  // ─── Pipeline Execution ──────────────────────────────────

  describe('Pipeline Execution', () => {
    it('should execute a simple pipeline', async () => {
      const run = await executePipeline({
        pipelineId: 'test-simple',
        brandId: 'test-brand',
        inputs: { text: 'hello world' },
        brand: mockBrand,
        llm: mockLLM,
        tools: mockTools,
        memory: mockMemory,
        logger: mockLogger,
      });

      expect(run.status).toBe('completed');
      expect(run.steps).toHaveLength(1);
      expect(run.steps[0].status).toBe('completed');
      expect(run.steps[0].output).toEqual({ result: 'from-a', text: 'hello' });
    });

    it('should chain step outputs via $variable references', async () => {
      const run = await executePipeline({
        pipelineId: 'test-chained',
        brandId: 'test-brand',
        inputs: { text: 'chain test' },
        brand: mockBrand,
        llm: mockLLM,
        tools: mockTools,
        memory: mockMemory,
        logger: mockLogger,
      });

      expect(run.status).toBe('completed');
      expect(run.steps).toHaveLength(2);
      expect(run.steps[0].status).toBe('completed');
      expect(run.steps[1].status).toBe('completed');
    });

    it('should skip steps with false conditions', async () => {
      const run = await executePipeline({
        pipelineId: 'test-conditional',
        brandId: 'test-brand',
        inputs: { text: 'cond test', skip_second: true },
        brand: mockBrand,
        llm: mockLLM,
        tools: mockTools,
        memory: mockMemory,
        logger: mockLogger,
      });

      expect(run.status).toBe('completed');
      // Only step1 should have run (step2 skipped by condition)
      expect(run.steps).toHaveLength(1);
    });

    it('should fail when pipeline not found', async () => {
      await expect(
        executePipeline({
          pipelineId: 'non-existent',
          brandId: 'test-brand',
          inputs: {},
          brand: mockBrand,
          llm: mockLLM,
          tools: mockTools,
          memory: mockMemory,
          logger: mockLogger,
        })
      ).rejects.toThrow('Pipeline not found');
    });

    it('should fail when skill not found', async () => {
      // Create a pipeline with a non-existent skill
      const badDir = join(TEST_PIPELINES_DIR, 'bad');
      mkdirSync(badDir, { recursive: true });
      writeFileSync(join(badDir, 'bad.yaml'), yaml.dump({
        id: 'test-bad-skill',
        name: 'Bad Skill Pipeline',
        description: 'Has a missing skill',
        version: '1.0',
        trigger: { type: 'manual' },
        inputs: [],
        steps: [{ id: 's1', skill: 'nonexistent-skill', action: 'fail', inputs: {}, output: 'out' }],
        outputs: [],
      }));
      loadPipelines(badDir);

      const run = await executePipeline({
        pipelineId: 'test-bad-skill',
        brandId: 'test-brand',
        inputs: {},
        brand: mockBrand,
        llm: mockLLM,
        tools: mockTools,
        memory: mockMemory,
        logger: mockLogger,
      });

      expect(run.status).toBe('failed');
      expect(run.error).toContain('nonexistent-skill');
      rmSync(badDir, { recursive: true, force: true });
    });

    it('should track metering data', async () => {
      const run = await executePipeline({
        pipelineId: 'test-simple',
        brandId: 'test-brand',
        inputs: { text: 'metering test' },
        brand: mockBrand,
        llm: mockLLM,
        tools: mockTools,
        memory: mockMemory,
        logger: mockLogger,
      });

      expect(run.metering.totalTokens).toBeGreaterThan(0);
      expect(run.metering.totalCostUnits).toBeGreaterThan(0);
      expect(run.metering.totalDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── Retry Logic ─────────────────────────────────────────

  describe('Retry Logic', () => {
    it('should retry and recover from failures', async () => {
      // Skill fails 2 times then succeeds, pipeline has max 3 retries
      const retrySkill = createFailingSkill('mock-skill-retry', 2);
      registerSkill(retrySkill);

      const run = await executePipeline({
        pipelineId: 'test-retry',
        brandId: 'test-brand',
        inputs: { text: 'retry test' },
        brand: mockBrand,
        llm: mockLLM,
        tools: mockTools,
        memory: mockMemory,
        logger: mockLogger,
      });

      expect(run.status).toBe('completed');
      expect(run.steps[0].status).toBe('completed');
      expect(run.steps[0].output).toEqual({ result: 'recovered' });
      expect(retrySkill.execute).toHaveBeenCalledTimes(3); // 2 failures + 1 success
    });

    it('should fail after exhausting retries', async () => {
      // Skill always fails, pipeline has max 3 retries
      const alwaysFailSkill = createFailingSkill('mock-skill-retry', 999);
      registerSkill(alwaysFailSkill);

      const run = await executePipeline({
        pipelineId: 'test-retry',
        brandId: 'test-brand',
        inputs: { text: 'fail test' },
        brand: mockBrand,
        llm: mockLLM,
        tools: mockTools,
        memory: mockMemory,
        logger: mockLogger,
      });

      expect(run.status).toBe('failed');
      expect(run.steps[0].status).toBe('failed');
      expect(alwaysFailSkill.execute).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  // ─── Parallel Execution ──────────────────────────────────

  describe('Parallel Execution', () => {
    it('should execute steps in parallel with count', async () => {
      const run = await executePipeline({
        pipelineId: 'test-parallel',
        brandId: 'test-brand',
        inputs: { text: 'parallel test' },
        brand: mockBrand,
        llm: mockLLM,
        tools: mockTools,
        memory: mockMemory,
        logger: mockLogger,
      });

      expect(run.status).toBe('completed');
      // Should have 3 step runs (count: 3)
      expect(run.steps).toHaveLength(3);
      expect(run.steps[0].stepId).toBe('step1[0]');
      expect(run.steps[1].stepId).toBe('step1[1]');
      expect(run.steps[2].stepId).toBe('step1[2]');
    });

    it('should collect parallel outputs into an array', async () => {
      // Create a chained pipeline where step2 uses parallel step1 output
      const parallelChainDir = join(TEST_PIPELINES_DIR, 'pchain');
      mkdirSync(parallelChainDir, { recursive: true });
      writeFileSync(join(parallelChainDir, 'pchain.yaml'), yaml.dump({
        id: 'test-parallel-chain',
        name: 'Parallel Chain',
        description: 'Parallel then chain',
        version: '1.0',
        trigger: { type: 'manual' },
        inputs: [{ name: 'text', type: 'string', required: true }],
        steps: [
          {
            id: 'step1',
            skill: 'mock-skill-a',
            action: 'Parallel',
            inputs: { text: '${inputs.text}' },
            config: { parallel: true, count: 2 },
            output: 'results',
          },
          {
            id: 'step2',
            skill: 'mock-skill-b',
            action: 'Use results',
            inputs: { data: '$results' },
            output: 'final',
          },
        ],
        outputs: [],
      }));
      loadPipelines(parallelChainDir);

      const run = await executePipeline({
        pipelineId: 'test-parallel-chain',
        brandId: 'test-brand',
        inputs: { text: 'chain' },
        brand: mockBrand,
        llm: mockLLM,
        tools: mockTools,
        memory: mockMemory,
        logger: mockLogger,
      });

      expect(run.status).toBe('completed');
      // 2 from parallel + 1 from chained
      expect(run.steps).toHaveLength(3);
      rmSync(parallelChainDir, { recursive: true, force: true });
    });
  });

  // ─── Trigger Matching ────────────────────────────────────

  describe('Pipeline Trigger Matching', () => {
    it('should match a pipeline by trigger pattern', () => {
      const match = matchPipeline('run simple test');
      expect(match).toBeDefined();
      expect(match!.pipeline.id).toBe('test-simple');
    });

    it('should match SEO blog pipeline', () => {
      const match = matchPipeline('write a blog post about marketing');
      expect(match).toBeDefined();
      expect(match!.pipeline.id).toBe('test-trigger-seo');
    });

    it('should return undefined for no match', () => {
      const match = matchPipeline('xyzzy no match here 12345');
      expect(match).toBeUndefined();
    });

    it('should return all matches sorted by score', () => {
      const matches = matchAllPipelines('run simple chain test');
      expect(matches.length).toBeGreaterThanOrEqual(1);
      // Should be sorted by score descending
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
      }
    });

    it('should match pipeline with complex regex', () => {
      const match = matchPipeline('seo blog post');
      expect(match).toBeDefined();
      expect(match!.pipeline.id).toBe('test-trigger-seo');
    });
  });
});
