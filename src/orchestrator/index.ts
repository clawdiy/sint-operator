/**
 * Marketing Orchestrator v3
 * 
 * Central coordination layer:
 * - Intelligent model routing (Opus/Sonnet/Kimi)
 * - Progressive skill discovery
 * - Brand context injection
 * - Usage metering with hard stops
 * - Asset routing to platform-specific formats
 * - Pipeline trigger matching
 * - Direct skill execution for quick actions (bypasses unimplemented pipeline skills)
 */

import { join } from 'path';
import { loadPipelines, executePipeline, listPipelines, getPipeline, getRun, listRuns, matchPipeline, matchAllPipelines } from '../core/pipeline/engine.js';
import { loadBrands, getBrand, listBrands, saveBrand, createBrand } from '../core/brand/manager.js';
import { ingestAsset, ingestText, ingestUrl, getAsset, listAssets } from '../core/assets/processor.js';
import { registerSkill, discoverSkills, listSkillSummaries, getRegistrySize, getTokenEstimate, getSkill } from '../core/skills/registry.js';
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
import { videoClipperSkill } from '../skills/video-clipper/index.js';
import { linkedinWriterSkill } from '../skills/linkedin-writer/index.js';
import { outputPackagerSkill } from '../skills/output-packager/index.js';
import { brandResearcherSkill } from '../skills/brand-researcher/index.js';
import { serpScraperSkill } from '../skills/serp-scraper/index.js';
import { seoOptimizerSkill } from '../skills/seo-optimizer/index.js';
import { notifierSkill } from '../skills/notifier/index.js';
import { newsletterSkill } from '../skills/newsletter/index.js';
import { competitorAnalyzerSkill } from '../skills/competitor-analyzer/index.js';

import type { BrandProfile, PipelineRun, Logger, ModelConfig, StepRun } from '../core/types.js';

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

    // Register built-in skills (13 total)
    registerSkill(assetIngesterSkill);
    registerSkill(contentAnalyzerSkill);
    registerSkill(contentRepurposeSkill);
    registerSkill(seoBlogSkill);
    registerSkill(socialCalendarSkill);
    registerSkill(platformFormatterSkill);
    registerSkill(videoClipperSkill);
    registerSkill(linkedinWriterSkill);
    registerSkill(outputPackagerSkill);
    registerSkill(brandResearcherSkill);
    registerSkill(serpScraperSkill);
    registerSkill(seoOptimizerSkill);
    registerSkill(notifierSkill);
    registerSkill(newsletterSkill);
    registerSkill(competitorAnalyzerSkill);

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

  // ─── Pipeline Matching ────────────────────────────────────

  matchPipeline(input: string) { return matchPipeline(input); }
  matchAllPipelines(input: string) { return matchAllPipelines(input); }

  // ─── Quick Actions (Direct Skill Execution) ───────────────
  // These bypass the full pipeline YAML (which references unimplemented skills)
  // and call the registered skills directly for reliable end-to-end execution.

  async repurposeContent(brandId: string, content: string, platforms: string[]): Promise<PipelineRun> {
    const brand = getBrand(brandId);
    if (!brand) throw new Error(`Brand not found: ${brandId}`);

    const asset = ingestText(content, join(this.config.dataDir, 'assets'));

    const run: PipelineRun = {
      id: `repurpose-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pipelineId: 'content-repurpose',
      brandId,
      status: 'running',
      steps: [],
      inputs: { text: content, target_platforms: platforms, asset_id: asset.id },
      outputs: [],
      startedAt: new Date().toISOString(),
      metering: { totalTokens: 0, totalCostUnits: 0, modelBreakdown: {}, totalDurationMs: 0 },
    };

    try {
      const skill = getSkill('content-repurpose');
      if (!skill) throw new Error('content-repurpose skill not found');

      const start = Date.now();
      const result = await skill.execute({
        inputs: { text: content, target_platforms: platforms },
        brand,
        llm: this.llm,
        tools: this.tools,
        memory: this.memory,
        logger: this.logger,
      });

      run.steps.push({
        stepId: 'content-repurpose',
        status: 'completed',
        modelUsed: result.modelUsed,
        startedAt: run.startedAt,
        completedAt: new Date().toISOString(),
        output: result.output,
        tokensUsed: result.tokensUsed,
        costUnits: result.costUnits,
        durationMs: Date.now() - start,
      });
      run.status = 'completed';
      run.metering.totalTokens = result.tokensUsed;
      run.metering.totalCostUnits = result.costUnits;
      if (result.modelUsed) {
        run.metering.modelBreakdown[result.modelUsed] = {
          tokens: result.tokensUsed,
          costUnits: result.costUnits,
        };
      }
    } catch (err) {
      run.status = 'failed';
      run.error = err instanceof Error ? err.message : String(err);
      this.logger.error('Repurpose failed', { error: run.error });
    }

    run.completedAt = new Date().toISOString();
    run.metering.totalDurationMs = Date.now() - new Date(run.startedAt).getTime();
    return run;
  }

  async generateBlogPost(brandId: string, topic: string, keywords: string[]): Promise<PipelineRun> {
    const brand = getBrand(brandId);
    if (!brand) throw new Error(`Brand not found: ${brandId}`);

    const run: PipelineRun = {
      id: `blog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pipelineId: 'seo-blog',
      brandId,
      status: 'running',
      steps: [],
      inputs: { topic, keywords },
      outputs: [],
      startedAt: new Date().toISOString(),
      metering: { totalTokens: 0, totalCostUnits: 0, modelBreakdown: {}, totalDurationMs: 0 },
    };

    try {
      const skill = getSkill('seo-blog');
      if (!skill) throw new Error('seo-blog skill not found');

      const start = Date.now();
      const result = await skill.execute({
        inputs: { topic, keywords, word_count: 1500, style: 'informational' },
        brand,
        llm: this.llm,
        tools: this.tools,
        memory: this.memory,
        logger: this.logger,
      });

      run.steps.push({
        stepId: 'seo-blog',
        status: 'completed',
        modelUsed: result.modelUsed,
        startedAt: run.startedAt,
        completedAt: new Date().toISOString(),
        output: result.output,
        tokensUsed: result.tokensUsed,
        costUnits: result.costUnits,
        durationMs: Date.now() - start,
      });
      run.status = 'completed';
      run.metering.totalTokens = result.tokensUsed;
      run.metering.totalCostUnits = result.costUnits;
      if (result.modelUsed) {
        run.metering.modelBreakdown[result.modelUsed] = {
          tokens: result.tokensUsed,
          costUnits: result.costUnits,
        };
      }
    } catch (err) {
      run.status = 'failed';
      run.error = err instanceof Error ? err.message : String(err);
      this.logger.error('Blog generation failed', { error: run.error });
    }

    run.completedAt = new Date().toISOString();
    run.metering.totalDurationMs = Date.now() - new Date(run.startedAt).getTime();
    return run;
  }

  async generateSocialCalendar(brandId: string, days: number, themes: string[]): Promise<PipelineRun> {
    const brand = getBrand(brandId);
    if (!brand) throw new Error(`Brand not found: ${brandId}`);

    const run: PipelineRun = {
      id: `calendar-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      pipelineId: 'social-calendar',
      brandId,
      status: 'running',
      steps: [],
      inputs: { days, themes },
      outputs: [],
      startedAt: new Date().toISOString(),
      metering: { totalTokens: 0, totalCostUnits: 0, modelBreakdown: {}, totalDurationMs: 0 },
    };

    try {
      const skill = getSkill('social-calendar');
      if (!skill) throw new Error('social-calendar skill not found');

      const start = Date.now();
      const result = await skill.execute({
        inputs: { days, themes, platforms: ['twitter', 'linkedin', 'instagram'], posts_per_day: 1 },
        brand,
        llm: this.llm,
        tools: this.tools,
        memory: this.memory,
        logger: this.logger,
      });

      run.steps.push({
        stepId: 'social-calendar',
        status: 'completed',
        modelUsed: result.modelUsed,
        startedAt: run.startedAt,
        completedAt: new Date().toISOString(),
        output: result.output,
        tokensUsed: result.tokensUsed,
        costUnits: result.costUnits,
        durationMs: Date.now() - start,
      });
      run.status = 'completed';
      run.metering.totalTokens = result.tokensUsed;
      run.metering.totalCostUnits = result.costUnits;
      if (result.modelUsed) {
        run.metering.modelBreakdown[result.modelUsed] = {
          tokens: result.tokensUsed,
          costUnits: result.costUnits,
        };
      }
    } catch (err) {
      run.status = 'failed';
      run.error = err instanceof Error ? err.message : String(err);
      this.logger.error('Calendar generation failed', { error: run.error });
    }

    run.completedAt = new Date().toISOString();
    run.metering.totalDurationMs = Date.now() - new Date(run.startedAt).getTime();
    return run;
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

  async testLLM() { return this.llm.testConnection(); }

  setUsageLimits(limits: { daily?: number; monthly?: number; perRun?: number }) {
    this.metering.setLimits(limits);
  }

  // ─── Generic Skill Execution (for MCP) ──────────────────

  async runSkill(
    skillId: string,
    brandId: string,
    inputs: Record<string, unknown>,
  ): Promise<{ output: Record<string, unknown>; tokensUsed: number; costUnits: number; modelUsed: string; durationMs: number }> {
    const brand = getBrand(brandId);
    if (!brand) throw new Error(\`Brand not found: \${brandId}\`);

    const skill = getSkill(skillId);
    if (!skill) throw new Error(\`Skill not found: \${skillId}\`);

    const ctx = {
      inputs,
      brand,
      llm: this.llm,
      tools: this.tools,
      memory: this.memory,
      logger: this.logger,
    };

    const result = await skill.execute(ctx);

    this.metering.record({
      id: \`mcp-\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`,
      runId: \`mcp-\${Date.now()}\`,
      stepId: skillId,
      model: result.modelUsed,
      tier: 'routine' as const,
      inputTokens: 0,
      outputTokens: 0,
      costUnits: result.costUnits,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  // ─── Cleanup ──────────────────────────────────────────────

  shutdown(): void {
    this.memory.close();
    this.metering.close();
    this.logger.info('Orchestrator shut down');
  }
}

