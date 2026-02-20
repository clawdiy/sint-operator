/**
 * Marketing Orchestrator
 * 
 * The brain that ties everything together:
 * - Receives assets/inputs
 * - Selects the right pipeline
 * - Injects brand context
 * - Routes outputs to platform-specific formats
 * - Tracks usage and metering
 */

import { join } from 'path';
import { nanoid } from 'nanoid';
import {
  loadPipelines,
  executePipeline,
  listPipelines,
  getPipeline,
  getRun,
  listRuns,
  registerSkill,
} from '../core/pipeline/engine.js';
import { loadBrands, getBrand, listBrands, buildBrandContext, saveBrand, createBrand } from '../core/brand/manager.js';
import { ingestAsset, ingestText, ingestUrl, getAsset, listAssets } from '../core/assets/processor.js';
import { MemoryStore } from '../core/memory/store.js';
import { OpenAIService } from '../services/llm/openai.js';
import { createToolServices } from '../services/tools/index.js';
import { createLogger } from '../services/logger.js';

// Import skills
import { contentRepurposeSkill } from '../skills/content-repurpose/index.js';
import { seoBlogSkill } from '../skills/seo-blog/index.js';
import { socialCalendarSkill } from '../skills/social-calendar/index.js';
import { platformFormatterSkill } from '../skills/platform-formatter/index.js';

import type { BrandProfile, PipelineRun, Logger } from '../core/types.js';

export interface OrchestratorConfig {
  dataDir: string;
  configDir: string;
  openaiApiKey: string;
  openaiBaseUrl?: string;
  defaultModel?: string;
}

export class Orchestrator {
  private memory: MemoryStore;
  private llm: OpenAIService;
  private tools: ReturnType<typeof createToolServices>;
  private logger: Logger;
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.logger = createLogger(join(config.dataDir, 'logs'));

    // Initialize services
    this.llm = new OpenAIService({
      apiKey: config.openaiApiKey,
      baseUrl: config.openaiBaseUrl,
      defaultModel: config.defaultModel ?? 'gpt-4o',
    });

    this.memory = new MemoryStore(join(config.dataDir, 'memory.db'));
    this.memory.setLLM(this.llm);
    this.tools = createToolServices();

    // Register skills
    registerSkill(contentRepurposeSkill);
    registerSkill(seoBlogSkill);
    registerSkill(socialCalendarSkill);
    registerSkill(platformFormatterSkill);

    // Load configs
    loadPipelines(join(config.configDir, 'pipelines'));
    loadBrands(join(config.configDir, 'brands'));

    this.logger.info('Orchestrator initialized', {
      pipelines: listPipelines().length,
      brands: listBrands().length,
    });
  }

  // ─── Pipeline Execution ───────────────────────────────────

  async runPipeline(
    pipelineId: string,
    brandId: string,
    inputs: Record<string, unknown>
  ): Promise<PipelineRun> {
    const brand = getBrand(brandId);
    if (!brand) throw new Error(`Brand not found: ${brandId}`);

    return executePipeline({
      pipelineId,
      brandId,
      inputs,
      brand,
      llm: this.llm,
      tools: this.tools,
      memory: this.memory,
      logger: this.logger,
      onStepComplete: (step) => {
        this.logger.info(`Step completed: ${step.stepId}`, {
          status: step.status,
          tokens: step.tokensUsed,
          duration: step.durationMs,
        });
      },
    });
  }

  // ─── Quick Actions (one-shot helpers) ─────────────────────

  async repurposeContent(
    brandId: string,
    content: string,
    platforms: string[]
  ): Promise<PipelineRun> {
    const asset = ingestText(content, join(this.config.dataDir, 'assets'));
    return this.runPipeline('content-repurpose', brandId, {
      asset_id: asset.id,
      text: content,
      target_platforms: platforms,
    });
  }

  async generateBlogPost(
    brandId: string,
    topic: string,
    keywords: string[]
  ): Promise<PipelineRun> {
    return this.runPipeline('seo-blog', brandId, {
      topic,
      keywords,
    });
  }

  async generateSocialCalendar(
    brandId: string,
    days: number,
    themes: string[]
  ): Promise<PipelineRun> {
    return this.runPipeline('social-calendar', brandId, {
      days,
      themes,
    });
  }

  // ─── Asset Management ─────────────────────────────────────

  async uploadAsset(filePath: string, originalName?: string) {
    return ingestAsset({
      filePath,
      assetsDir: join(this.config.dataDir, 'assets'),
      originalName,
    });
  }

  getAsset(id: string) {
    return getAsset(id);
  }

  listAssets() {
    return listAssets();
  }

  // ─── Brand Management ─────────────────────────────────────

  createBrand(data: Omit<BrandProfile, 'id' | 'createdAt' | 'updatedAt'>) {
    const brand = createBrand(data);
    saveBrand(brand, join(this.config.configDir, 'brands'));
    return brand;
  }

  getBrand(id: string) {
    return getBrand(id);
  }

  listBrands() {
    return listBrands();
  }

  // ─── Pipeline Info ────────────────────────────────────────

  listPipelines() {
    return listPipelines();
  }

  getPipeline(id: string) {
    return getPipeline(id);
  }

  getRun(id: string) {
    return getRun(id);
  }

  listRuns() {
    return listRuns();
  }

  // ─── Cleanup ──────────────────────────────────────────────

  shutdown(): void {
    this.memory.close();
    this.logger.info('Orchestrator shut down');
  }
}
