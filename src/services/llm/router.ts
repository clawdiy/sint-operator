/**
 * LLM Router — Intelligent model routing for cost control
 * 
 * Routes requests to:
 * - Claude Opus 4.6 for complex tasks (strategy, analysis, long-form)
 * - Claude Sonnet 4.5 for routine tasks (formatting, simple generation)
 * - Kimi-K2.5 as cost-effective fallback
 * 
 * Tracks token usage and cost units per request for metering.
 * 
 * Features:
 * - Dry-run mode when OPENAI_API_KEY is empty or "sk-test"
 * - Graceful error handling with useful error messages
 * - Request timeouts (30s routine, 60s complex)
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

// Timeout constants
const ROUTINE_TIMEOUT_MS = 30_000;
const COMPLEX_TIMEOUT_MS = 60_000;

export interface LLMRouterConfig {
  apiKey: string;
  baseUrl?: string;
  models: ModelConfig;
  embeddingModel?: string;
  maxRetries?: number;
}

/**
 * Check if we should run in dry-run mode (no real LLM calls).
 */
function isDryRun(apiKey: string): boolean {
  return !apiKey || apiKey === 'sk-test' || apiKey.trim() === '';
}

/**
 * Create a timeout-aborting signal with a given ms.
 */
function createTimeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}

/**
 * Generate mock JSON data based on a schema hint.
 * Produces realistic-looking placeholder data for demo/UI purposes.
 */
function generateMockJSON(schema: unknown, prompt: string): Record<string, unknown> {
  // Try to infer from schema structure
  const s = schema as Record<string, unknown> | undefined;
  const properties = (s?.properties as Record<string, unknown>) ?? {};

  const result: Record<string, unknown> = {};

  for (const [key, spec] of Object.entries(properties)) {
    const prop = spec as Record<string, unknown>;
    const type = prop?.type as string;

    switch (type) {
      case 'array':
        result[key] = generateMockArray(key, prompt);
        break;
      case 'string':
        result[key] = generateMockString(key, prompt);
        break;
      case 'number':
      case 'integer':
        result[key] = generateMockNumber(key);
        break;
      case 'boolean':
        result[key] = true;
        break;
      case 'object':
        result[key] = {};
        break;
      default:
        result[key] = generateMockString(key, prompt);
    }
  }

  // If schema was sparse, try to produce something useful from prompt context
  if (Object.keys(result).length === 0) {
    return generateMockFromPrompt(prompt);
  }

  return result;
}

function generateMockArray(key: string, prompt: string): unknown[] {
  const lk = key.toLowerCase();

  if (lk.includes('deliverable') || lk.includes('post') || lk.includes('content')) {
    // Detect platforms from prompt
    const platforms = ['twitter', 'linkedin', 'instagram', 'tiktok', 'facebook', 'blog', 'telegram'];
    const mentioned = platforms.filter(p => prompt.toLowerCase().includes(p));
    const targets = mentioned.length > 0 ? mentioned : ['twitter', 'linkedin'];

    return targets.map(platform => ({
      platform,
      format: platform === 'blog' ? 'article' : 'text',
      content: `[Mock ${platform} content — configure OPENAI_API_KEY for real output] This is a demo post about the topic you provided. It follows ${platform}'s best practices for engagement.`,
      hashtags: ['#MockContent', '#DryRun', '#SINT'],
      mediaPrompt: `Professional image related to the topic, optimized for ${platform}`,
      hook: 'Did you know this is a mock response?',
      notes: `Dry-run mode — set OPENAI_API_KEY for actual AI-generated content.`,
    }));
  }

  if (lk.includes('calendar') || lk.includes('day')) {
    const days = [];
    const baseDate = new Date();
    const dayCount = (prompt.match(/(\d+)\s*day/i)?.[1]) ? parseInt(prompt.match(/(\d+)\s*day/i)![1]) : 3;

    for (let i = 0; i < dayCount; i++) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        theme: `Day ${i + 1} Theme — Mock Content`,
        posts: [
          {
            platform: 'twitter',
            time: '09:00',
            content: `[Mock tweet for day ${i + 1}] Configure OPENAI_API_KEY for real content.`,
            hashtags: ['#DryRun'],
            mediaPrompt: 'Professional branded image',
            contentType: 'educational',
            notes: 'Dry-run placeholder',
          },
          {
            platform: 'linkedin',
            time: '12:00',
            content: `[Mock LinkedIn post for day ${i + 1}] Set up your API key to generate real content with SINT.`,
            hashtags: ['#DryRun'],
            mediaPrompt: 'Professional branded image',
            contentType: 'thought leadership',
            notes: 'Dry-run placeholder',
          },
        ],
      });
    }
    return days;
  }

  if (lk.includes('header') || lk.includes('heading')) {
    return ['H2: Introduction', 'H2: Key Concepts', 'H3: Details', 'H2: Conclusion'];
  }

  if (lk.includes('keyword')) {
    return ['mock-keyword', 'dry-run', 'SINT'];
  }

  return [{ mock: true, note: '[Dry-run] Configure OPENAI_API_KEY for real data' }];
}

function generateMockString(key: string, _prompt: string): string {
  const lk = key.toLowerCase();

  if (lk.includes('summary') || lk.includes('strategy')) {
    return '[Mock response — configure OPENAI_API_KEY for real output] This is a dry-run summary. SINT generated placeholder content for demo purposes.';
  }
  if (lk.includes('title')) return '[Mock] AI-Powered Content Strategy Guide';
  if (lk.includes('meta_title') || lk === 'metatitle') return 'Mock Title — SINT Dry Run | Configure API Key';
  if (lk.includes('meta_description') || lk === 'metadescription') return 'This is a mock meta description generated in dry-run mode. Set OPENAI_API_KEY for real SEO-optimized output.';
  if (lk.includes('slug')) return 'mock-dry-run-article';
  if (lk.includes('content') || lk.includes('article') || lk.includes('body')) {
    return '# Mock Article\n\n[Dry-run mode — configure OPENAI_API_KEY for real output]\n\n## Introduction\n\nThis is a placeholder article generated by SINT in dry-run mode. The pipeline is working correctly.\n\n## Key Points\n\n- Point 1: The pipeline executed all steps successfully\n- Point 2: Brand context was properly injected\n- Point 3: Platform constraints were respected\n\n## Conclusion\n\nSet your OPENAI_API_KEY to get real AI-generated content.\n';
  }
  if (lk.includes('schema')) return 'Article';
  if (lk.includes('note')) return 'Dry-run mode — no real LLM calls made.';

  return `[Mock: ${key}]`;
}

function generateMockNumber(key: string): number {
  const lk = key.toLowerCase();
  if (lk.includes('word_count') || lk.includes('wordcount')) return 1500;
  if (lk.includes('reading') || lk.includes('time')) return 7;
  if (lk.includes('total') || lk.includes('count')) return 5;
  return 0;
}

function generateMockFromPrompt(prompt: string): Record<string, unknown> {
  // Try to infer structure from prompt keywords
  const lower = prompt.toLowerCase();

  if (lower.includes('repurpose') || lower.includes('deliverable')) {
    return {
      deliverables: generateMockArray('deliverables', prompt),
      summary: '[Dry-run] Mock repurpose output — configure OPENAI_API_KEY for real content generation.',
    };
  }

  if (lower.includes('calendar') || lower.includes('schedule')) {
    return {
      strategy: '[Dry-run] Mock content strategy for demonstration.',
      calendar: generateMockArray('calendar', prompt),
      summary: '[Dry-run] Mock calendar generated.',
      totalPosts: 6,
    };
  }

  if (lower.includes('blog') || lower.includes('article') || lower.includes('seo')) {
    return {
      title: '[Mock] AI-Powered Content Strategy',
      metaTitle: 'Mock SEO Title — Configure API Key',
      metaDescription: 'Mock meta description for dry-run mode.',
      slug: 'mock-article-dry-run',
      keywords: { primary: 'mock', secondary: ['dry-run'], lsi: ['demo'] },
      headers: ['H2: Introduction', 'H2: Main Content', 'H2: Conclusion'],
      schemaType: 'Article',
    };
  }

  // Generic fallback
  return {
    result: '[Dry-run] Mock response — configure OPENAI_API_KEY for real output.',
    mock: true,
  };
}

export class LLMRouterImpl implements LLMRouter {
  private client: OpenAI;
  private models: ModelConfig;
  private embeddingModel: string;
  private totalTokens = 0;
  private totalCostUnits = 0;
  private dryRunMode: boolean;
  private apiKey: string;

  constructor(config: LLMRouterConfig) {
    this.apiKey = config.apiKey;
    this.dryRunMode = isDryRun(config.apiKey);

    this.client = new OpenAI({
      apiKey: config.apiKey || 'sk-placeholder',
      baseURL: config.baseUrl,
      maxRetries: config.maxRetries ?? 3,
    });
    this.models = config.models;
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-3-small';

    if (this.dryRunMode) {
      console.log('🔸 LLM Router: DRY-RUN mode (no real API calls). Set OPENAI_API_KEY for live mode.');
    }
  }

  /** Check if running in dry-run mode */
  isDryRun(): boolean {
    return this.dryRunMode;
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

  private getTimeoutForTier(tier: ModelTier): number {
    return tier === 'complex' ? COMPLEX_TIMEOUT_MS : ROUTINE_TIMEOUT_MS;
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

    // Dry-run mode: return mock response
    if (this.dryRunMode) {
      return {
        text: '[Mock response — configure OPENAI_API_KEY for real output]',
        meta: {
          model: 'dry-run',
          tier,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUnits: 0,
          durationMs: Date.now() - start,
        },
      };
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const timeoutMs = this.getTimeoutForTier(tier);

    try {
      const timeout = createTimeoutSignal(timeoutMs);
      try {
        const response = await this.client.chat.completions.create(
          {
            model,
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 4096,
          },
          { signal: timeout.signal }
        );
        timeout.clear();

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
      } finally {
        timeout.clear();
      }
    } catch (err) {
      // Try fallback on error (unless already on fallback)
      if (tier !== 'fallback' && this.models.fallback) {
        console.warn(`[LLM] ${model} failed (${formatError(err)}), falling back to ${this.models.fallback}`);
        try {
          return await this.complete(prompt, { ...options, model: this.models.fallback, tier: 'fallback' as any });
        } catch (fallbackErr) {
          // Fallback also failed — return graceful error response
          console.error(`[LLM] Fallback also failed: ${formatError(fallbackErr)}`);
          return {
            text: `[LLM Error] All models failed. Last error: ${formatError(err)}. Check your API key and network connection.`,
            meta: {
              model: 'error',
              tier,
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              costUnits: 0,
              durationMs: Date.now() - start,
            },
          };
        }
      }

      // No fallback available — return graceful error
      console.error(`[LLM] ${model} failed with no fallback: ${formatError(err)}`);
      return {
        text: `[LLM Error] ${formatError(err)}. Check your API key and network connection.`,
        meta: {
          model: 'error',
          tier,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUnits: 0,
          durationMs: Date.now() - start,
        },
      };
    }
  }

  async completeJSON<T>(
    prompt: string,
    schema: unknown,
    options?: LLMOptions
  ): Promise<{ data: T; meta: LLMResponseMeta }> {
    const { model, tier } = this.resolveModel(options);
    const start = Date.now();

    // Dry-run mode: return mock JSON
    if (this.dryRunMode) {
      const mockData = generateMockJSON(schema, prompt);
      return {
        data: mockData as T,
        meta: {
          model: 'dry-run',
          tier,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUnits: 0,
          durationMs: Date.now() - start,
        },
      };
    }

    const systemPrompt = [
      options?.systemPrompt ?? '',
      '\nYou MUST respond with valid JSON matching the following schema.',
      'Do NOT include markdown code fences or any text outside the JSON.',
      `\nSchema:\n${JSON.stringify(schema, null, 2)}`,
    ].join('\n');

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    const timeoutMs = this.getTimeoutForTier(tier);

    try {
      const timeout = createTimeoutSignal(timeoutMs);
      try {
        const response = await this.client.chat.completions.create(
          {
            model,
            messages,
            temperature: options?.temperature ?? 0.3,
            max_tokens: options?.maxTokens ?? 4096,
            response_format: { type: 'json_object' },
          },
          { signal: timeout.signal }
        );
        timeout.clear();

        const inputTokens = response.usage?.prompt_tokens ?? 0;
        const outputTokens = response.usage?.completion_tokens ?? 0;
        const totalTokens = inputTokens + outputTokens;
        const costUnits = this.calculateCost(model, totalTokens);

        this.totalTokens += totalTokens;
        this.totalCostUnits += costUnits;

        const text = response.choices[0]?.message?.content ?? '{}';
        let parsed: T;
        try {
          parsed = JSON.parse(text) as T;
        } catch (parseErr) {
          console.error(`[LLM] JSON parse error for model ${model}. Raw: ${text.slice(0, 500)}`);
          // Try to extract JSON from the response
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]) as T;
          } else {
            throw new Error(`LLM returned invalid JSON: ${text.slice(0, 200)}`);
          }
        }

        return {
          data: parsed,
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
      } finally {
        timeout.clear();
      }
    } catch (err) {
      // Try fallback
      if (tier !== 'fallback' && this.models.fallback) {
        console.warn(`[LLM] ${model} JSON failed (${formatError(err)}), falling back to ${this.models.fallback}`);
        try {
          return await this.completeJSON<T>(prompt, schema, { ...options, model: this.models.fallback });
        } catch (fallbackErr) {
          console.error(`[LLM] Fallback JSON also failed: ${formatError(fallbackErr)}`);
          // Return mock data as graceful degradation
          const mockData = generateMockJSON(schema, prompt);
          return {
            data: mockData as T,
            meta: {
              model: 'error-fallback',
              tier,
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
              costUnits: 0,
              durationMs: Date.now() - start,
            },
          };
        }
      }

      // No fallback — return mock as graceful error
      console.error(`[LLM] ${model} JSON failed with no fallback: ${formatError(err)}`);
      const mockData = generateMockJSON(schema, prompt);
      return {
        data: mockData as T,
        meta: {
          model: 'error',
          tier,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUnits: 0,
          durationMs: Date.now() - start,
        },
      };
    }
  }

  async embedText(text: string): Promise<number[]> {
    // Dry-run mode: return empty embedding
    if (this.dryRunMode) {
      return [];
    }

    try {
      const timeout = createTimeoutSignal(ROUTINE_TIMEOUT_MS);
      try {
        const response = await this.client.embeddings.create(
          {
            model: this.embeddingModel,
            input: text,
          },
          { signal: timeout.signal }
        );
        timeout.clear();
        return response.data[0]?.embedding ?? [];
      } finally {
        timeout.clear();
      }
    } catch (err) {
      console.warn(`[LLM] Embedding failed (${formatError(err)}). Returning empty vector.`);
      return [];
    }
  }

  // ─── Connection Test ────────────────────────────────────

  async testConnection(): Promise<{ ok: boolean; mode: string; model?: string; error?: string }> {
    if (this.dryRunMode) {
      return { ok: true, mode: 'dry-run' };
    }

    try {
      const timeout = createTimeoutSignal(15_000);
      try {
        const response = await this.client.chat.completions.create(
          {
            model: this.models.routine,
            messages: [{ role: 'user', content: 'Say "ok"' }],
            max_tokens: 5,
          },
          { signal: timeout.signal }
        );
        timeout.clear();

        return {
          ok: true,
          mode: 'live',
          model: response.model,
        };
      } finally {
        timeout.clear();
      }
    } catch (err) {
      return {
        ok: false,
        mode: 'error',
        error: formatError(err),
      };
    }
  }

  // ─── Usage Stats ────────────────────────────────────────

  getUsage(): { totalTokens: number; totalCostUnits: number } {
    return { totalTokens: this.totalTokens, totalCostUnits: this.totalCostUnits };
  }
}

// ─── Helpers ──────────────────────────────────────────────────

function formatError(err: unknown): string {
  if (err instanceof Error) {
    // OpenAI SDK errors often have useful status/code info
    const e = err as any;
    if (e.status) return `${e.status}: ${e.message}`;
    if (e.code === 'ECONNREFUSED') return 'Connection refused — check API base URL';
    if (e.code === 'ENOTFOUND') return 'DNS resolution failed — check network';
    if (err.name === 'AbortError') return 'Request timed out';
    return err.message;
  }
  return String(err);
}
