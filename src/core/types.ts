/**
 * SINT Marketing Operator — Core Type Definitions
 * v0.2.0 — Full architecture spec
 */

// ─── Model Routing ────────────────────────────────────────────

export type ModelTier = 'complex' | 'routine' | 'fallback';

export interface ModelConfig {
  complex: string;    // Claude Opus 4.6 — strategy, analysis, complex generation
  routine: string;    // Claude Sonnet 4.5 — formatting, simple tasks
  fallback: string;   // Kimi-K2.5 — cost-effective fallback
}

export interface ModelRouting {
  tier: ModelTier;
  model: string;
  reason: string;
}

// ─── Pipeline Types ───────────────────────────────────────────

export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  trigger: PipelineTrigger;
  inputs: PipelineInput[];
  steps: PipelineStep[];
  outputs: OutputSpec[];
}

export interface PipelineTrigger {
  type: 'asset_upload' | 'schedule' | 'webhook' | 'manual';
  pattern?: string;     // regex for trigger matching e.g. "repurpose|shred|turn.*into.*posts"
  accept?: string[];    // MIME types for asset_upload
  schedule?: string;    // cron for schedule
}

export interface PipelineInput {
  name: string;
  type: 'file' | 'string' | 'number' | 'boolean' | 'array' | 'reference';
  description?: string;
  default?: unknown;
  required?: boolean;
}

export interface PipelineStep {
  id: string;
  name?: string;
  skill: string;
  model?: string;          // explicit model override
  modelTier?: ModelTier;   // or route by tier
  action: string;          // description of what this step does
  inputs: Record<string, string | StepReference>;
  config?: Record<string, unknown>;
  condition?: string;
  retry?: { max: number; backoff: 'linear' | 'exponential' };
  output: string;          // output variable name
}

export interface StepReference {
  $ref: string;  // e.g. "$raw_transcript" or "steps.extract_text.output.text"
}

export interface OutputSpec {
  platform: Platform;
  format: ContentFormat;
  template?: string;
  constraints: PlatformConstraints;
}

// ─── Platform Types ───────────────────────────────────────────

export type Platform =
  | 'twitter' | 'linkedin' | 'instagram' | 'instagram_reels' | 'tiktok'
  | 'facebook' | 'youtube' | 'youtube_shorts' | 'blog' | 'email'
  | 'telegram' | 'discord' | 'threads' | 'pinterest';

export type ContentFormat =
  | 'text' | 'image' | 'video' | 'carousel'
  | 'story' | 'reel' | 'thread' | 'article'
  | 'newsletter' | 'caption' | 'script' | 'infographic'
  | 'ad_copy' | 'pdf_report';

export interface PlatformConstraints {
  maxLength?: number;
  maxImages?: number;
  aspectRatio?: string;
  maxDuration?: number;    // seconds
  maxFileSize?: number;    // bytes
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
  tone: string[];
  style: string;
  doNot: string[];
  vocabulary: string[];
  examples: string[];
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
  credentials?: string;
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
  timestamps?: TimestampedSegment[];
  tags?: string[];
}

export interface TimestampedSegment {
  start: number;
  end: number;
  text: string;
  score?: number;         // platform suitability score
  hooks?: string[];       // identified hooks in this segment
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
  metering: MeteringData;
}

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface StepRun {
  stepId: string;
  status: RunStatus;
  modelUsed?: string;
  modelTier?: ModelTier;
  startedAt?: string;
  completedAt?: string;
  output?: unknown;
  error?: string;
  tokensUsed?: number;
  costUnits?: number;
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

export interface MeteringData {
  totalTokens: number;
  totalCostUnits: number;
  modelBreakdown: Record<string, { tokens: number; costUnits: number }>;
  totalDurationMs: number;
}

// ─── Skill Types (Progressive Disclosure) ─────────────────────

export interface SkillManifest {
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  allowedTools: string[];
  memoryScope: 'private' | 'shared' | 'global';
  costUnits: number;
  triggers?: string[];
}

export type SkillLevel = 'L1' | 'L2' | 'L3';

export interface SkillRegistryEntry {
  manifest: SkillManifest;
  level: SkillLevel;
  skillDir: string;
  loaded: boolean;
  skill?: Skill;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  costUnits: number;
  inputs: SkillInput[];
  outputs: SkillOutput[];
  execute: (ctx: SkillContext) => Promise<SkillResult>;
}

export interface SkillInput {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'asset' | 'object' | 'array' | 'file' | 'reference';
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
  llm: LLMRouter;
  tools: ToolServices;
  memory: MemoryService;
  logger: Logger;
}

export interface SkillResult {
  output: Record<string, unknown>;
  tokensUsed: number;
  costUnits: number;
  modelUsed: string;
  durationMs: number;
}

// ─── Service Interfaces ───────────────────────────────────────

export interface LLMRouter {
  complete(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
  completeJSON<T>(prompt: string, schema: unknown, options?: LLMOptions): Promise<{ data: T; meta: LLMResponseMeta }>;
  embedText(text: string): Promise<number[]>;
  routeModel(task: string): ModelRouting;
}

export interface LLMOptions {
  model?: string;
  tier?: ModelTier;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  text: string;
  meta: LLMResponseMeta;
}

export interface LLMResponseMeta {
  model: string;
  tier: ModelTier;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUnits: number;
  durationMs: number;
}

export interface ToolServices {
  ffmpeg: FFmpegService;
  sharp: SharpService;
  browser: BrowserService;
  whisper: WhisperService;
}

export interface FFmpegService {
  extractClip(input: string, start: number, duration: number, output: string): Promise<string>;
  transcode(input: string, options: Record<string, unknown>): Promise<string>;
  extractAudio(input: string, output: string): Promise<string>;
  generateThumbnail(input: string, timestamp: number, output: string): Promise<string>;
  getMetadata(input: string): Promise<Record<string, unknown>>;
}

export interface SharpService {
  resize(input: string, width: number, height: number, output: string): Promise<string>;
  crop(input: string, options: Record<string, unknown>, output: string): Promise<string>;
  addWatermark(input: string, watermark: string, output: string): Promise<string>;
  toFormat(input: string, format: string, output: string): Promise<string>;
  createSocialCard(options: SocialCardOptions): Promise<string>;
}

export interface SocialCardOptions {
  title: string;
  subtitle?: string;
  background?: string;
  brandColors: string[];
  fonts: string[];
  output: string;
  size: { width: number; height: number };
}

export interface BrowserService {
  screenshot(url: string, output: string, options?: Record<string, unknown>): Promise<string>;
  scrape(url: string, selector?: string): Promise<string>;
  pdf(url: string, output: string): Promise<string>;
  serpScrape(query: string): Promise<SERPResult[]>;
}

export interface SERPResult {
  position: number;
  title: string;
  url: string;
  snippet: string;
}

export interface WhisperService {
  transcribe(audioPath: string, options?: TranscribeOptions): Promise<TranscriptResult>;
}

export interface TranscribeOptions {
  language?: string;
  timestamps?: boolean;
  format?: 'text' | 'srt' | 'vtt' | 'json';
}

export interface TranscriptResult {
  text: string;
  segments: TimestampedSegment[];
  language: string;
  duration: number;
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

// ─── Metering Types ───────────────────────────────────────────

export interface MeterEntry {
  id: string;
  runId: string;
  stepId: string;
  model: string;
  tier: ModelTier;
  inputTokens: number;
  outputTokens: number;
  costUnits: number;
  timestamp: string;
}

export interface UsageSummary {
  period: string;
  totalRuns: number;
  totalTokens: number;
  totalCostUnits: number;
  byModel: Record<string, { tokens: number; costUnits: number; runs: number }>;
  byPipeline: Record<string, { runs: number; costUnits: number }>;
  byBrand: Record<string, { runs: number; costUnits: number }>;
}
