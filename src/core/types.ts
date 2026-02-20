/**
 * SINT Marketing Operator — Core Type Definitions
 */

// ─── Pipeline Types ───────────────────────────────────────────

export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  trigger: PipelineTrigger;
  steps: PipelineStep[];
  outputs: OutputSpec[];
}

export interface PipelineTrigger {
  type: 'asset_upload' | 'schedule' | 'webhook' | 'manual';
  accept?: string[];  // MIME types for asset_upload
  schedule?: string;  // cron for schedule
}

export interface PipelineStep {
  id: string;
  name: string;
  skill: string;
  inputs: Record<string, string | StepReference>;
  config?: Record<string, unknown>;
  condition?: string;  // JS expression evaluated at runtime
  retry?: { max: number; backoff: 'linear' | 'exponential' };
}

export interface StepReference {
  $ref: string;  // e.g. "steps.extract_text.output.text"
}

export interface OutputSpec {
  platform: Platform;
  format: ContentFormat;
  template?: string;
  constraints: PlatformConstraints;
}

// ─── Platform Types ───────────────────────────────────────────

export type Platform = 
  | 'twitter' | 'linkedin' | 'instagram' | 'tiktok' 
  | 'facebook' | 'youtube' | 'blog' | 'email' 
  | 'telegram' | 'discord' | 'threads';

export type ContentFormat = 
  | 'text' | 'image' | 'video' | 'carousel' 
  | 'story' | 'reel' | 'thread' | 'article'
  | 'newsletter' | 'caption';

export interface PlatformConstraints {
  maxLength?: number;
  maxImages?: number;
  aspectRatio?: string;
  maxDuration?: number;  // seconds
  maxFileSize?: number;  // bytes
  hashtagLimit?: number;
  features?: string[];
}

// ─── Brand Types ──────────────────────────────────────────────

export interface BrandProfile {
  id: string;
  name: string;
  voice: BrandVoice;
  visual: BrandVisual;
  platforms: PlatformConfig[];
  keywords: string[];
  competitors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BrandVoice {
  tone: string[];          // e.g. ["professional", "innovative", "bold"]
  style: string;           // prose description
  doNot: string[];         // things to avoid
  vocabulary: string[];    // preferred terms
  examples: string[];      // example posts/copy
}

export interface BrandVisual {
  primaryColors: string[];
  secondaryColors: string[];
  fonts: string[];
  logoUrl?: string;
  watermark?: boolean;
}

export interface PlatformConfig {
  platform: Platform;
  handle: string;
  credentials?: string;   // reference to secret store
  enabled: boolean;
  postingSchedule?: string;
}

// ─── Asset Types ──────────────────────────────────────────────

export interface Asset {
  id: string;
  type: AssetType;
  originalName: string;
  path: string;
  mimeType: string;
  size: number;
  metadata: AssetMetadata;
  createdAt: string;
}

export type AssetType = 'image' | 'video' | 'audio' | 'document' | 'url' | 'text';

export interface AssetMetadata {
  width?: number;
  height?: number;
  duration?: number;
  pages?: number;
  wordCount?: number;
  extractedText?: string;
  transcript?: string;
  tags?: string[];
}

// ─── Execution Types ──────────────────────────────────────────

export interface PipelineRun {
  id: string;
  pipelineId: string;
  brandId: string;
  status: RunStatus;
  steps: StepRun[];
  inputs: Record<string, unknown>;
  outputs: GeneratedOutput[];
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface StepRun {
  stepId: string;
  status: RunStatus;
  startedAt?: string;
  completedAt?: string;
  output?: unknown;
  error?: string;
  tokensUsed?: number;
  durationMs?: number;
}

export interface GeneratedOutput {
  id: string;
  runId: string;
  platform: Platform;
  format: ContentFormat;
  content: string;
  mediaUrls?: string[];
  metadata: Record<string, unknown>;
  approved?: boolean;
  publishedAt?: string;
}

// ─── Skill Types ──────────────────────────────────────────────

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  inputs: SkillInput[];
  outputs: SkillOutput[];
  execute: (ctx: SkillContext) => Promise<SkillResult>;
}

export interface SkillInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'asset' | 'object' | 'array';
  required: boolean;
  description: string;
  default?: unknown;
}

export interface SkillOutput {
  name: string;
  type: string;
  description: string;
}

export interface SkillContext {
  inputs: Record<string, unknown>;
  brand: BrandProfile;
  llm: LLMService;
  tools: ToolServices;
  memory: MemoryService;
  logger: Logger;
}

export interface SkillResult {
  output: Record<string, unknown>;
  tokensUsed: number;
  durationMs: number;
}

// ─── Service Interfaces ───────────────────────────────────────

export interface LLMService {
  complete(prompt: string, options?: LLMOptions): Promise<string>;
  completeJSON<T>(prompt: string, schema: unknown, options?: LLMOptions): Promise<T>;
  embedText(text: string): Promise<number[]>;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface ToolServices {
  ffmpeg: FFmpegService;
  sharp: SharpService;
  browser: BrowserService;
}

export interface FFmpegService {
  extractClip(input: string, start: number, duration: number, output: string): Promise<string>;
  transcode(input: string, options: Record<string, unknown>): Promise<string>;
  extractAudio(input: string, output: string): Promise<string>;
  getMetadata(input: string): Promise<Record<string, unknown>>;
}

export interface SharpService {
  resize(input: string, width: number, height: number, output: string): Promise<string>;
  crop(input: string, options: Record<string, unknown>, output: string): Promise<string>;
  addWatermark(input: string, watermark: string, output: string): Promise<string>;
  toFormat(input: string, format: string, output: string): Promise<string>;
}

export interface BrowserService {
  screenshot(url: string, output: string, options?: Record<string, unknown>): Promise<string>;
  scrape(url: string, selector?: string): Promise<string>;
  pdf(url: string, output: string): Promise<string>;
}

export interface MemoryService {
  store(collection: string, id: string, text: string, metadata?: Record<string, unknown>): Promise<void>;
  search(collection: string, query: string, limit?: number): Promise<MemoryResult[]>;
  get(collection: string, id: string): Promise<MemoryResult | null>;
  delete(collection: string, id: string): Promise<void>;
}

export interface MemoryResult {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface Logger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}
