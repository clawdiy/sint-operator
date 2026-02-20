/**
 * LLM Router — Intelligent model routing for cost control
 * 
 * Routes requests to:
 * - Claude Opus 4.6 for complex tasks (strategy, analysis, long-form)
 * - Claude Sonnet 4.5 for routine tasks (formatting, simple generation)
 * - Kimi-K2.5 as cost-effective fallback
 * 
 * Tracks token usage and cost units per request for metering.
 */

import OpenAI from 'openai';
import type {
  LLMRouter, LLMOptions, LLMResponse, LLMResponseMeta,
  ModelConfig, ModelTier, ModelRouting,
} from '../../core/types.js';

// Cost units per 1K tokens (approximate relative costs)
const COST_RATES: Record<string, number> = {
  'claude-opus-4-6':     15.0,
  'claude-sonnet-4-5':    3.0,
  'kimi-k2.5':            0.5,
  'gpt-4o':               5.0,
  'gpt-4o-mini':          0.3,
};

// Task patterns for automatic routing
const COMPLEX_PATTERNS = [
  /strateg/i, /analyz/i, /research/i, /compet/i,
  /long.?form/i, /article/i, /blog.?post/i,
  /brand.?voice/i, /content.?map/i, /campaign/i,
  /seo.?optim/i, /hook.?moment/i,
];

const ROUTINE_PATTERNS = [
  /format/i, /reformat/i, /hashtag/i, /caption/i,
  /shorten/i, /truncat/i, /convert/i, /template/i,
  /schedule/i, /time.?slot/i,
];

export interface LLMRouterConfig {
  apiKey: string;
  baseUrl?: string;
  models: ModelConfig;
  embeddingModel?: string;
  maxRetries?: number;
}

export class LLMRouterImpl implements LLMRouter {
  private client: OpenAI;
  private models: ModelConfig;
  private embeddingModel: string;
  private totalTokens = 0;
  private totalCostUnits = 0;

  constructor(config: LLMRouterConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      maxRetries: config.maxRetries ?? 3,
    });
    this.models = config.models;
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-3-small';
  }

  // ─── Model Routing ──────────────────────────────────────

  routeModel(task: string): ModelRouting {
    // Check for complex patterns
    for (const pattern of COMPLEX_PATTERNS) {
      if (pattern.test(task)) {
        return {
          tier: 'complex',
          model: this.models.complex,
          reason: `Complex task detected: ${pattern.source}`,
        };
      }
    }

    // Check for routine patterns
    for (const pattern of ROUTINE_PATTERNS) {
      if (pattern.test(task)) {
        return {
          tier: 'routine',
          model: this.models.routine,
          reason: `Routine task detected: ${pattern.source}`,
        };
      }
    }

    // Default to routine for cost efficiency
    return {
      tier: 'routine',
      model: this.models.routine,
      reason: 'Default routing to routine tier',
    };
  }

  private resolveModel(options?: LLMOptions): { model: string; tier: ModelTier } {
    if (options?.model) {
      const tier = this.getTierForModel(options.model);
      return { model: options.model, tier };
    }
    if (options?.tier) {
      return { model: this.models[options.tier], tier: options.tier };
    }
    return { model: this.models.routine, tier: 'routine' };
  }

  private getTierForModel(model: string): ModelTier {
    if (model === this.models.complex) return 'complex';
    if (model === this.models.fallback) return 'fallback';
    return 'routine';
  }

  private calculateCost(model: string, tokens: number): number {
    // Find matching cost rate
    for (const [pattern, rate] of Object.entries(COST_RATES)) {
      if (model.includes(pattern)) {
        return (tokens / 1000) * rate;
      }
    }
    return (tokens / 1000) * 3.0; // default rate
  }

  // ─── Completions ────────────────────────────────────────

  async complete(prompt: string, options?: LLMOptions): Promise<LLMResponse> {
    const { model, tier } = this.resolveModel(options);
    const start = Date.now();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
      });

      const inputTokens = response.usage?.prompt_tokens ?? 0;
      const outputTokens = response.usage?.completion_tokens ?? 0;
      const totalTokens = inputTokens + outputTokens;
      const costUnits = this.calculateCost(model, totalTokens);

      this.totalTokens += totalTokens;
      this.totalCostUnits += costUnits;

      return {
        text: response.choices[0]?.message?.content ?? '',
        meta: {
          model,
          tier,
          inputTokens,
          outputTokens,
          totalTokens,
          costUnits,
          durationMs: Date.now() - start,
        },
      };
    } catch (err) {
      // Fallback on error
      if (tier !== 'fallback' && this.models.fallback) {
        return this.complete(prompt, { ...options, model: this.models.fallback, tier: 'fallback' as any });
      }
      throw err;
    }
  }

  async completeJSON<T>(
    prompt: string,
    schema: unknown,
    options?: LLMOptions
  ): Promise<{ data: T; meta: LLMResponseMeta }> {
    const systemPrompt = [
      options?.systemPrompt ?? '',
      '\nYou MUST respond with valid JSON matching the following schema.',
      'Do NOT include markdown code fences or any text outside the JSON.',
      `\nSchema:\n${JSON.stringify(schema, null, 2)}`,
    ].join('\n');

    const { model, tier } = this.resolveModel(options);
    const start = Date.now();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages,
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 4096,
        response_format: { type: 'json_object' },
      });

      const inputTokens = response.usage?.prompt_tokens ?? 0;
      const outputTokens = response.usage?.completion_tokens ?? 0;
      const totalTokens = inputTokens + outputTokens;
      const costUnits = this.calculateCost(model, totalTokens);

      this.totalTokens += totalTokens;
      this.totalCostUnits += costUnits;

      const text = response.choices[0]?.message?.content ?? '{}';
      return {
        data: JSON.parse(text) as T,
        meta: {
          model,
          tier,
          inputTokens,
          outputTokens,
          totalTokens,
          costUnits,
          durationMs: Date.now() - start,
        },
      };
    } catch (err) {
      if (tier !== 'fallback' && this.models.fallback) {
        return this.completeJSON<T>(prompt, schema, { ...options, model: this.models.fallback });
      }
      throw err;
    }
  }

  async embedText(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });
    return response.data[0]?.embedding ?? [];
  }

  // ─── Usage Stats ────────────────────────────────────────

  getUsage(): { totalTokens: number; totalCostUnits: number } {
    return { totalTokens: this.totalTokens, totalCostUnits: this.totalCostUnits };
  }
}
