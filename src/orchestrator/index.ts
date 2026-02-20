/**
 * Marketing Orchestrator v2
 * 
 * Central coordination layer:
 * - Intelligent model routing (Opus/Sonnet/Kimi)
 * - Progressive skill discovery
 * - Brand context injection
 * - Usage metering with hard stops
 * - Asset routing to platform-specific formats
 */

import { join } from 'path';
import { loadPipelines, executePipeline, listPipelines, getPipeline, getRun, listRuns } from '../core/pipeline/engine.js';
import { loadBrands, getBrand, listBrands, saveBrand, createBrand } from '../core/brand/manager.js';
import { ingestAsset, ingestText, ingestUrl, getAsset, listAssets } from '../core/assets/processor.js';
import { registerSkill, discoverSkills, listSkillSummaries, getRegistrySize, getTokenEstimate } from '../core/skills/registry.js';
import { MemoryStore } from '../core/memory/store.js';
import { LLMRouterImpl } from '../services/llm/router.js';
import { createToolServices } from '../services/tools/index.js';
import { MeteringTracker } from '../core/metering/tracker.js';
import { createLogger } from '../services/logger.js';

// Import built-in skills
import { contentRepurposeSkill } from '../skills/content-repurpose/index.js';
import { seoBlogSkill } from '../skills/seo-blog/index.js';
import { socialCalendarSkill } from '../skills/social-calendar/index.js';
import { platformFormatterSkill } from '../skills/platform-formatter/index.js';
import { assetIngesterSkill } from '../skills/asset-ingester/index.js';
import { contentAnalyzerSkill } from '../skills/content-analyzer/index.js';

import type { BrandProfile, PipelineRun, Logger, ModelConfig } from '../core/types.js';

export interface OrchestratorConfig {
  dataDir: string;
  configDir: string;
  openaiApiKey: string;
  openaiBaseUrl?: string;
  models: ModelConfig;
  embeddingModel?: string;
}

export class Orchestrator {
  private memory: MemoryStore;
  private llm: LLMRouterImpl;
  private tools: ReturnType<typeof createToolServices>;
  private metering: MeteringTracker;
  private logger: Logger;
  private config: OrchestratorConfig;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.logger = createLogger(join(config.dataDir, 'logs'));

    // Initialize LLM Router with model tiers
    this.llm = new LLMRouterImpl({
      apiKey: config.openaiApiKey,
      baseUrl: config.openaiBaseUrl,
      models: config.models,
      embeddingModel: config.embeddingModel,
    });

    // Initialize persistence
    this.memory = new MemoryStore(join(config.dataDir, 'memory.db'));
    this.memory.setLLM(this.llm);
    this.metering = new MeteringTracker(join(config.dataDir, 'metering.db'));

    // Initialize tools
    this.tools = createToolServices(config.openaiApiKey, config.openaiBaseUrl);

    // Register built-in skills
    registerSkill(assetIngesterSkill);
    registerSkill(contentAnalyzerSkill);
    registerSkill(contentRepurposeSkill);
    registerSkill(seoBlogSkill);
    registerSkill(socialCalendarSkill);
    registerSkill(platformFormatterSkill);

    // Discover external skills (L1 — manifest only)
    discoverSkills(join(config.configDir, 'skills'));

    // Load pipeline definitions
    loadPipelines(join(config.configDir, 'pipelines'));

    // Load brand profiles
    loadBrands(join(config.configDir, 'brands'));

    this.logger.info('Orchestrator initialized', {
      pipelines: listPipelines().length,
      brands: listBrands().length,
      skills: getRegistrySize(),
      skillTokenEstimate: getTokenEstimate(),
      models: config.models,
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
      metering: this.metering,
      onStepComplete: (step) => {
        this.logger.info(`Step ${step.stepId}: ${step.status}`, {
          model: step.modelUsed,
          tokens: step.tokensUsed,
          cost: step.costUnits,
          duration: step.durationMs,
        });
      },
    });
  }

  // ─── Quick Actions ────────────────────────────────────────

  async repurposeContent(brandId: string, content: string, platforms: string[]): Promise<PipelineRun> {
    const asset = ingestText(content, join(this.config.dataDir, 'assets'));
    return this.runPipeline('content-repurpose', brandId, {
      asset_id: asset.id,
      text: content,
      target_platforms: platforms,
    });
  }

  async generateBlogPost(brandId: string, topic: string, keywords: string[]): Promise<PipelineRun> {
    return this.runPipeline('seo-blog', brandId, { topic, keywords });
  }

  async generateSocialCalendar(brandId: string, days: number, themes: string[]): Promise<PipelineRun> {
    return this.runPipeline('social-calendar', brandId, { days, themes });
  }

  // ─── Asset Management ─────────────────────────────────────

  async uploadAsset(filePath: string, originalName?: string) {
    return ingestAsset({ filePath, assetsDir: join(this.config.dataDir, 'assets'), originalName });
  }

  getAsset(id: string) { return getAsset(id); }
  listAssets() { return listAssets(); }

  // ─── Brand Management ─────────────────────────────────────

  createBrand(data: Omit<BrandProfile, 'id' | 'createdAt' | 'updatedAt'>) {
    const brand = createBrand(data);
    saveBrand(brand, join(this.config.configDir, 'brands'));
    return brand;
  }

  getBrand(id: string) { return getBrand(id); }
  listBrands() { return listBrands(); }

  // ─── Pipeline Info ────────────────────────────────────────

  listPipelines() { return listPipelines(); }
  getPipeline(id: string) { return getPipeline(id); }
  getRun(id: string) { return getRun(id); }
  listRuns() { return listRuns(); }

  // ─── Skills ───────────────────────────────────────────────

  listSkills() { return listSkillSummaries(); }

  // ─── Metering ─────────────────────────────────────────────

  getUsageSummary(days?: number) { return this.metering.getSummary(days); }
  getModelUsage() { return this.llm.getUsage(); }
  
  setUsageLimits(limits: { daily?: number; monthly?: number; perRun?: number }) {
    this.metering.setLimits(limits);
  }

  // ─── Cleanup ──────────────────────────────────────────────

  shutdown(): void {
    this.memory.close();
    this.metering.close();
    this.logger.info('Orchestrator shut down');
  }
}
