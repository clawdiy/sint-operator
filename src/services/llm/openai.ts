/**
 * LLM Service — OpenAI-compatible implementation
 * 
 * Works with OpenAI, OpenRouter, local models via compatible API.
 * Handles completions, structured JSON output, and embeddings.
 */

import OpenAI from 'openai';
import type { LLMService, LLMOptions } from '../../core/types.js';

export interface OpenAIServiceConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  embeddingModel?: string;
  maxRetries?: number;
}

export class OpenAIService implements LLMService {
  private client: OpenAI;
  private defaultModel: string;
  private embeddingModel: string;

  constructor(config: OpenAIServiceConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      maxRetries: config.maxRetries ?? 3,
    });
    this.defaultModel = config.defaultModel ?? 'gpt-4o';
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-3-small';
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await this.client.chat.completions.create({
      model: options?.model ?? this.defaultModel,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    });

    return response.choices[0]?.message?.content ?? '';
  }

  async completeJSON<T>(prompt: string, schema: unknown, options?: LLMOptions): Promise<T> {
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

    const response = await this.client.chat.completions.create({
      model: options?.model ?? this.defaultModel,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
      response_format: { type: 'json_object' },
    });

    const text = response.choices[0]?.message?.content ?? '{}';
    return JSON.parse(text) as T;
  }

  async embedText(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.embeddingModel,
      input: text,
    });

    return response.data[0]?.embedding ?? [];
  }
}
