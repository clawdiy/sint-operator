/**
 * SINT Pipeline Engine v3
 * 
 * YAML-based deterministic pipeline execution with:
 * - Step chaining via $ref variables
 * - Conditional execution
 * - Retry with backoff
 * - Model tier routing per step
 * - Metering integration
 * - Audit trail
 * - Parallel step execution (Promise.all with concurrency limit)
 * - Batch processing (count field)
 * - Pipeline trigger matching (regex patterns)
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { nanoid } from 'nanoid';
import type {
  PipelineDefinition, PipelineRun, PipelineStep, StepRun,
  RunStatus, BrandProfile, LLMRouter, ToolServices, MemoryService,
  Logger, GeneratedOutput, MeteringData,
} from '../types.js';
import { getSkill } from '../skills/registry.js';
import type { MeteringTracker } from '../metering/tracker.js';

// ─── Constants ────────────────────────────────────────────────

const PARALLEL_CONCURRENCY_LIMIT = 5;

// ─── Pipeline Registry ────────────────────────────────────────

const pipelines = new Map<string, PipelineDefinition>();
const runs = new Map<string, PipelineRun>();

export function loadPipelines(dir: string): void {
  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    for (const file of files) {
      const raw = readFileSync(join(dir, file), 'utf-8');
      const def = yaml.load(raw) as PipelineDefinition;
      if (def?.id) {
        pipelines.set(def.id, def);
      }
    }
  } catch {
    // Directory might not exist yet
  }
}

export function getPipeline(id: string): PipelineDefinition | undefined {
  return pipelines.get(id);
}

export function listPipelines(): PipelineDefinition[] {
  return Array.from(pipelines.values());
}

export function getRun(id: string): PipelineRun | undefined {
  return runs.get(id);
}

export function listRuns(): PipelineRun[] {
  return Array.from(runs.values());
}

// ─── Pipeline Trigger Matching ────────────────────────────────

export interface TriggerMatch {
  pipeline: PipelineDefinition;
  score: number;
  matchedPattern: string;
}

/**
 * Match user input against pipeline trigger patterns.
 * Returns the best matching pipeline, or undefined if no match.
 */
export function matchPipeline(input: string): TriggerMatch | undefined {
  const matches: TriggerMatch[] = [];

  for (const pipeline of pipelines.values()) {
    if (!pipeline.trigger?.pattern) continue;

    try {
      const regex = new RegExp(pipeline.trigger.pattern, 'i');
      const match = regex.exec(input);
      if (match) {
        // Score based on match specificity: longer matches = higher score
        const score = match[0].length / input.length + (match[0].length / pipeline.trigger.pattern.length) * 0.5;
        matches.push({
          pipeline,
          score,
          matchedPattern: pipeline.trigger.pattern,
        });
      }
    } catch {
      // Invalid regex, skip
    }
  }

  if (matches.length === 0) return undefined;

  // Return the best match (highest score)
  matches.sort((a, b) => b.score - a.score);
  return matches[0];
}

/**
 * Match all pipelines against input. Returns all matches sorted by score.
 */
export function matchAllPipelines(input: string): TriggerMatch[] {
  const matches: TriggerMatch[] = [];

  for (const pipeline of pipelines.values()) {
    if (!pipeline.trigger?.pattern) continue;

    try {
      const regex = new RegExp(pipeline.trigger.pattern, 'i');
      const match = regex.exec(input);
      if (match) {
        const score = match[0].length / input.length + (match[0].length / pipeline.trigger.pattern.length) * 0.5;
        matches.push({
          pipeline,
          score,
          matchedPattern: pipeline.trigger.pattern,
        });
      }
    } catch {
      // Invalid regex, skip
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

// ─── Pipeline Executor ────────────────────────────────────────

export interface ExecuteOptions {
  pipelineId: string;
  brandId: string;
  inputs: Record<string, unknown>;
  brand: BrandProfile;
  llm: LLMRouter;
  tools: ToolServices;
  memory: MemoryService;
  logger: Logger;
  metering?: MeteringTracker;
  onStepComplete?: (step: StepRun) => void;
}

export async function executePipeline(opts: ExecuteOptions): Promise<PipelineRun> {
  const pipeline = pipelines.get(opts.pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${opts.pipelineId}`);
  }

  // Check metering limits
  if (opts.metering) {
    const limits = opts.metering.checkLimits();
    if (!limits.allowed) {
      throw new Error(`Usage limit reached: ${limits.reason}`);
    }
  }

  const run: PipelineRun = {
    id: nanoid(),
    pipelineId: opts.pipelineId,
    brandId: opts.brandId,
    status: 'running',
    steps: [],
    inputs: opts.inputs,
    outputs: [],
    startedAt: new Date().toISOString(),
    metering: {
      totalTokens: 0,
      totalCostUnits: 0,
      modelBreakdown: {},
      totalDurationMs: 0,
    },
  };

  runs.set(run.id, run);
  opts.logger.info(`Pipeline started: ${pipeline.name}`, { runId: run.id });

  // Variable store for $ref resolution between steps
  const variables = new Map<string, unknown>();

  // Copy pipeline inputs to variables
  for (const [key, value] of Object.entries(opts.inputs)) {
    variables.set(`inputs.${key}`, value);
  }

  try {
    for (const step of pipeline.steps) {
      // Check condition
      if (step.condition) {
        const result = evaluateCondition(step.condition, variables);
        if (!result) {
          opts.logger.info(`Skipping step (condition false): ${step.id}`);
          continue;
        }
      }

      // Check for parallel execution or batch count
      const stepConfig = step.config ?? {};
      const isParallel = stepConfig.parallel === true;
      const count = typeof stepConfig.count === 'number' ? stepConfig.count : 0;

      let stepRuns: StepRun[];

      if (isParallel && count > 1) {
        // Batch parallel execution: run the skill `count` times concurrently
        stepRuns = await executeStepParallel(step, count, {
          variables,
          brand: opts.brand,
          llm: opts.llm,
          tools: opts.tools,
          memory: opts.memory,
          logger: opts.logger,
          metering: opts.metering,
          runId: run.id,
          pipelineId: pipeline.id,
          brandId: opts.brandId,
        });
      } else if (count > 1) {
        // Sequential batch execution
        stepRuns = [];
        for (let i = 0; i < count; i++) {
          const indexedStep = injectIndex(step, i);
          const sr = await executeStep(indexedStep, {
            variables,
            brand: opts.brand,
            llm: opts.llm,
            tools: opts.tools,
            memory: opts.memory,
            logger: opts.logger,
            metering: opts.metering,
            runId: run.id,
            pipelineId: pipeline.id,
            brandId: opts.brandId,
          });
          stepRuns.push(sr);
        }
      } else {
        // Single step execution (normal path)
        const sr = await executeStep(step, {
          variables,
          brand: opts.brand,
          llm: opts.llm,
          tools: opts.tools,
          memory: opts.memory,
          logger: opts.logger,
          metering: opts.metering,
          runId: run.id,
          pipelineId: pipeline.id,
          brandId: opts.brandId,
        });
        stepRuns = [sr];
      }

      // Process results
      for (const stepRun of stepRuns) {
        run.steps.push(stepRun);

        // Update metering
        if (stepRun.tokensUsed) {
          run.metering.totalTokens += stepRun.tokensUsed;
        }
        if (stepRun.costUnits) {
          run.metering.totalCostUnits += stepRun.costUnits;
        }
        if (stepRun.modelUsed) {
          if (!run.metering.modelBreakdown[stepRun.modelUsed]) {
            run.metering.modelBreakdown[stepRun.modelUsed] = { tokens: 0, costUnits: 0 };
          }
          run.metering.modelBreakdown[stepRun.modelUsed].tokens += stepRun.tokensUsed ?? 0;
          run.metering.modelBreakdown[stepRun.modelUsed].costUnits += stepRun.costUnits ?? 0;
        }

        opts.onStepComplete?.(stepRun);
      }

      // Store step output in variables
      if (count > 1 || isParallel) {
        // For batch/parallel steps, collect all outputs into an array
        const outputs = stepRuns
          .filter(sr => sr.status === 'completed' && sr.output !== undefined)
          .map(sr => sr.output);
        variables.set(`$${step.output}`, outputs);
      } else {
        // Single step output
        const stepRun = stepRuns[0];
        if (stepRun.status === 'completed' && stepRun.output !== undefined) {
          variables.set(`$${step.output}`, stepRun.output);
          // Also store nested values
          if (typeof stepRun.output === 'object' && stepRun.output !== null) {
            for (const [k, v] of Object.entries(stepRun.output as Record<string, unknown>)) {
              variables.set(`$${step.output}.${k}`, v);
            }
          }
        }
      }

      // Check for any failures
      const failed = stepRuns.find(sr => sr.status === 'failed');
      if (failed) {
        run.status = 'failed';
        run.error = `Step "${step.id}" failed: ${failed.error}`;
        break;
      }
    }

    if (run.status === 'running') {
      run.status = 'completed';
    }
  } catch (err) {
    run.status = 'failed';
    run.error = err instanceof Error ? err.message : String(err);
  }

  run.completedAt = new Date().toISOString();
  run.metering.totalDurationMs = Date.now() - new Date(run.startedAt).getTime();

  opts.logger.info(`Pipeline ${run.status}: ${pipeline.name}`, {
    runId: run.id,
    steps: run.steps.length,
    tokens: run.metering.totalTokens,
    costUnits: run.metering.totalCostUnits,
    duration: run.metering.totalDurationMs,
  });

  return run;
}

// ─── Step Executor ────────────────────────────────────────────

interface StepContext {
  variables: Map<string, unknown>;
  brand: BrandProfile;
  llm: LLMRouter;
  tools: ToolServices;
  memory: MemoryService;
  logger: Logger;
  metering?: MeteringTracker;
  runId: string;
  pipelineId: string;
  brandId: string;
}

/**
 * Execute a step in parallel `count` times with a concurrency limit.
 */
async function executeStepParallel(
  step: PipelineStep,
  count: number,
  ctx: StepContext
): Promise<StepRun[]> {
  ctx.logger.info(`Parallel execution: ${step.id} x${count} (concurrency: ${PARALLEL_CONCURRENCY_LIMIT})`);

  const results: StepRun[] = [];
  const queue: Array<() => Promise<StepRun>> = [];

  for (let i = 0; i < count; i++) {
    const indexedStep = injectIndex(step, i);
    queue.push(() => executeStep(indexedStep, ctx));
  }

  // Process with concurrency limit
  for (let i = 0; i < queue.length; i += PARALLEL_CONCURRENCY_LIMIT) {
    const batch = queue.slice(i, i + PARALLEL_CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(batch.map(fn => fn()));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Create a copy of a step with the index injected into inputs.
 */
function injectIndex(step: PipelineStep, index: number): PipelineStep {
  const inputs = { ...step.inputs, _index: String(index) };
  return { ...step, inputs, id: `${step.id}[${index}]` };
}

async function executeStep(step: PipelineStep, ctx: StepContext): Promise<StepRun> {
  const stepRun: StepRun = {
    stepId: step.id,
    status: 'running',
    startedAt: new Date().toISOString(),
  };

  const skill = getSkill(step.skill);
  if (!skill) {
    stepRun.status = 'failed';
    stepRun.error = `Skill not found: ${step.skill}`;
    stepRun.completedAt = new Date().toISOString();
    return stepRun;
  }

  // Resolve inputs — handle $variable references
  const resolvedInputs = resolveInputs(step.inputs, ctx.variables);

  const maxRetries = step.retry?.max ?? 0;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = step.retry?.backoff === 'exponential'
          ? Math.pow(2, attempt) * 1000
          : attempt * 2000;
        await sleep(delay);
        ctx.logger.info(`Retrying step: ${step.id} (attempt ${attempt + 1})`);
      }

      const start = Date.now();
      const result = await skill.execute({
        inputs: resolvedInputs,
        brand: ctx.brand,
        llm: ctx.llm,
        tools: ctx.tools,
        memory: ctx.memory,
        logger: ctx.logger,
      });

      stepRun.status = 'completed';
      stepRun.output = result.output;
      stepRun.tokensUsed = result.tokensUsed;
      stepRun.costUnits = result.costUnits;
      stepRun.modelUsed = result.modelUsed;
      stepRun.modelTier = step.modelTier;
      stepRun.durationMs = Date.now() - start;
      stepRun.completedAt = new Date().toISOString();

      // Record metering
      if (ctx.metering) {
        ctx.metering.record({
          id: nanoid(),
          runId: ctx.runId,
          stepId: step.id,
          pipelineId: ctx.pipelineId,
          brandId: ctx.brandId,
          model: result.modelUsed,
          tier: step.modelTier ?? 'routine',
          inputTokens: Math.floor(result.tokensUsed * 0.6),
          outputTokens: Math.floor(result.tokensUsed * 0.4),
          costUnits: result.costUnits,
          timestamp: new Date().toISOString(),
        });
      }

      ctx.logger.info(`Step completed: ${step.id}`, {
        duration: stepRun.durationMs,
        tokens: result.tokensUsed,
        cost: result.costUnits,
        model: result.modelUsed,
      });

      return stepRun;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      ctx.logger.warn(`Step attempt failed: ${step.id}`, { attempt, error: lastError.message });
    }
  }

  stepRun.status = 'failed';
  stepRun.error = lastError?.message ?? 'Unknown error';
  stepRun.completedAt = new Date().toISOString();
  return stepRun;
}

// ─── Variable Resolution ──────────────────────────────────────

export function resolveInputs(
  inputs: Record<string, unknown>,
  variables: Map<string, unknown>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(inputs)) {
    resolved[key] = resolveValue(value, variables);
  }

  return resolved;
}

export function resolveValue(value: unknown, variables: Map<string, unknown>): unknown {
  if (typeof value === 'string') {
    // $variable reference (direct)
    if (value.startsWith('$')) {
      return variables.get(value) ?? value;
    }
    // ${path.to.value} template (exact match — single expression)
    if (value.startsWith('${') && value.endsWith('}') && !value.slice(2, -1).includes('${')) {
      const path = value.slice(2, -1);
      return variables.get(path) ?? variables.get(`$${path}`) ?? value;
    }
    // Inline template replacement
    return value.replace(/\$\{([^}]+)\}/g, (_, path) => {
      const val = variables.get(path) ?? variables.get(`$${path}`);
      return val !== undefined ? String(val) : `\${${path}}`;
    });
  }

  if (typeof value === 'object' && value !== null && '$ref' in value) {
    const ref = (value as { $ref: string }).$ref;
    return variables.get(ref) ?? variables.get(`$${ref}`) ?? value;
  }

  return value;
}

export function evaluateCondition(condition: string, variables: Map<string, unknown>): boolean {
  try {
    const context = Object.fromEntries(variables);
    const fn = new Function('ctx', `with(ctx) { return !!(${condition}); }`);
    return fn(context);
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
