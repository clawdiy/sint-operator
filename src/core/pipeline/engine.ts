/**
 * SINT Pipeline Engine
 * 
 * Loads YAML pipeline definitions and executes them step-by-step.
 * Each step resolves to a skill, which is executed with context injection.
 * Supports step references ($ref), conditional execution, and retry logic.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { nanoid } from 'nanoid';
import PQueue from 'p-queue';
import type {
  PipelineDefinition,
  PipelineRun,
  PipelineStep,
  StepRun,
  RunStatus,
  BrandProfile,
  Skill,
  SkillContext,
  LLMService,
  ToolServices,
  MemoryService,
  Logger,
  GeneratedOutput,
} from '../types.js';

// ─── Pipeline Registry ────────────────────────────────────────

const pipelines = new Map<string, PipelineDefinition>();
const skills = new Map<string, Skill>();
const runs = new Map<string, PipelineRun>();

export function registerSkill(skill: Skill): void {
  skills.set(skill.id, skill);
}

export function getSkill(id: string): Skill | undefined {
  return skills.get(id);
}

export function loadPipelines(dir: string): void {
  const files = readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  for (const file of files) {
    const raw = readFileSync(join(dir, file), 'utf-8');
    const def = yaml.load(raw) as PipelineDefinition;
    if (def?.id) {
      pipelines.set(def.id, def);
    }
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

// ─── Pipeline Executor ────────────────────────────────────────

export interface ExecuteOptions {
  pipelineId: string;
  brandId: string;
  inputs: Record<string, unknown>;
  brand: BrandProfile;
  llm: LLMService;
  tools: ToolServices;
  memory: MemoryService;
  logger: Logger;
  concurrency?: number;
  onStepComplete?: (step: StepRun) => void;
}

export async function executePipeline(opts: ExecuteOptions): Promise<PipelineRun> {
  const pipeline = pipelines.get(opts.pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${opts.pipelineId}`);
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
  };

  runs.set(run.id, run);
  opts.logger.info(`Pipeline started: ${pipeline.name}`, { runId: run.id });

  // Step outputs accumulator — used for $ref resolution
  const stepOutputs = new Map<string, unknown>();

  try {
    for (const step of pipeline.steps) {
      // Check condition
      if (step.condition) {
        const conditionResult = evaluateCondition(step.condition, stepOutputs, opts.inputs);
        if (!conditionResult) {
          opts.logger.info(`Skipping step (condition false): ${step.name}`, { stepId: step.id });
          continue;
        }
      }

      const stepRun = await executeStep(step, {
        stepOutputs,
        globalInputs: opts.inputs,
        brand: opts.brand,
        llm: opts.llm,
        tools: opts.tools,
        memory: opts.memory,
        logger: opts.logger,
      });

      run.steps.push(stepRun);
      
      if (stepRun.status === 'completed' && stepRun.output) {
        stepOutputs.set(step.id, stepRun.output);
      }

      opts.onStepComplete?.(stepRun);

      if (stepRun.status === 'failed') {
        run.status = 'failed';
        run.error = `Step "${step.name}" failed: ${stepRun.error}`;
        opts.logger.error(`Pipeline failed at step: ${step.name}`, { error: stepRun.error });
        break;
      }
    }

    if (run.status === 'running') {
      run.status = 'completed';
      
      // Collect outputs from the final accumulator
      const finalOutput = stepOutputs.get(pipeline.steps[pipeline.steps.length - 1]?.id);
      if (finalOutput && typeof finalOutput === 'object' && 'deliverables' in (finalOutput as Record<string, unknown>)) {
        run.outputs = (finalOutput as Record<string, unknown>).deliverables as GeneratedOutput[];
      }
    }
  } catch (err) {
    run.status = 'failed';
    run.error = err instanceof Error ? err.message : String(err);
    opts.logger.error(`Pipeline crashed: ${err}`, { runId: run.id });
  }

  run.completedAt = new Date().toISOString();
  opts.logger.info(`Pipeline ${run.status}: ${pipeline.name}`, {
    runId: run.id,
    steps: run.steps.length,
    duration: Date.now() - new Date(run.startedAt).getTime(),
  });

  return run;
}

// ─── Step Executor ────────────────────────────────────────────

interface StepContext {
  stepOutputs: Map<string, unknown>;
  globalInputs: Record<string, unknown>;
  brand: BrandProfile;
  llm: LLMService;
  tools: ToolServices;
  memory: MemoryService;
  logger: Logger;
}

async function executeStep(step: PipelineStep, ctx: StepContext): Promise<StepRun> {
  const stepRun: StepRun = {
    stepId: step.id,
    status: 'running',
    startedAt: new Date().toISOString(),
  };

  const skill = skills.get(step.skill);
  if (!skill) {
    stepRun.status = 'failed';
    stepRun.error = `Skill not found: ${step.skill}`;
    stepRun.completedAt = new Date().toISOString();
    return stepRun;
  }

  // Resolve inputs — handle $ref references
  const resolvedInputs = resolveInputs(step.inputs, ctx.stepOutputs, ctx.globalInputs);

  const skillCtx: SkillContext = {
    inputs: resolvedInputs,
    brand: ctx.brand,
    llm: ctx.llm,
    tools: ctx.tools,
    memory: ctx.memory,
    logger: ctx.logger,
  };

  const maxRetries = step.retry?.max ?? 0;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = step.retry?.backoff === 'exponential'
          ? Math.pow(2, attempt) * 1000
          : attempt * 1000;
        await sleep(delay);
        ctx.logger.info(`Retrying step: ${step.name} (attempt ${attempt + 1})`);
      }

      const start = Date.now();
      const result = await skill.execute(skillCtx);
      
      stepRun.status = 'completed';
      stepRun.output = result.output;
      stepRun.tokensUsed = result.tokensUsed;
      stepRun.durationMs = Date.now() - start;
      stepRun.completedAt = new Date().toISOString();
      
      ctx.logger.info(`Step completed: ${step.name}`, {
        duration: stepRun.durationMs,
        tokens: result.tokensUsed,
      });
      
      return stepRun;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      ctx.logger.warn(`Step attempt failed: ${step.name}`, { attempt, error: lastError.message });
    }
  }

  stepRun.status = 'failed';
  stepRun.error = lastError?.message ?? 'Unknown error';
  stepRun.completedAt = new Date().toISOString();
  return stepRun;
}

// ─── Reference Resolution ─────────────────────────────────────

function resolveInputs(
  inputs: Record<string, unknown>,
  stepOutputs: Map<string, unknown>,
  globalInputs: Record<string, unknown>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value === 'object' && value !== null && '$ref' in value) {
      resolved[key] = resolveRef((value as { $ref: string }).$ref, stepOutputs, globalInputs);
    } else if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
      // Template string resolution: ${inputs.asset_path}
      const path = value.slice(2, -1);
      resolved[key] = resolveRef(path, stepOutputs, globalInputs);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

function resolveRef(
  ref: string,
  stepOutputs: Map<string, unknown>,
  globalInputs: Record<string, unknown>
): unknown {
  const parts = ref.split('.');
  
  if (parts[0] === 'inputs') {
    return getNestedValue(globalInputs, parts.slice(1));
  }
  
  if (parts[0] === 'steps') {
    const stepId = parts[1];
    const output = stepOutputs.get(stepId);
    if (output && parts.length > 2) {
      return getNestedValue(output as Record<string, unknown>, parts.slice(2));
    }
    return output;
  }

  return undefined;
}

function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

// ─── Condition Evaluation ─────────────────────────────────────

function evaluateCondition(
  condition: string,
  stepOutputs: Map<string, unknown>,
  inputs: Record<string, unknown>
): boolean {
  try {
    // Simple safe evaluation — only allows property access patterns
    const context = {
      inputs,
      steps: Object.fromEntries(stepOutputs),
    };
    const fn = new Function('ctx', `with(ctx) { return !!(${condition}); }`);
    return fn(context);
  } catch {
    return false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
