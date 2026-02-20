/**
 * Asset Ingester Skill
 * 
 * Handles initial asset intake:
 * - Video: extract audio → Whisper transcription → timestamped transcript
 * - Article URL: scrape + clean text
 * - Text/Document: pass through with metadata
 * 
 * This is Step 1 in most content pipelines.
 */

import { readFileSync, existsSync } from 'fs';
import { extname } from 'path';
import { join } from 'path';
import type { Skill, SkillContext, SkillResult } from '../../core/types.js';

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.flac'];
const DOC_EXTENSIONS = ['.txt', '.md', '.pdf', '.doc', '.docx'];

export const assetIngesterSkill: Skill = {
  id: 'asset-ingester',
  name: 'Asset Ingester',
  description: 'Ingest any asset type and extract structured content. Handles video transcription, web scraping, and document parsing.',
  version: '1.0.0',
  costUnits: 5,
  inputs: [
    { name: 'source_asset', type: 'string', required: true, description: 'File path, URL, or raw text' },
    { name: 'asset_type', type: 'string', required: false, description: 'Override type detection', default: 'auto' },
  ],
  outputs: [
    { name: 'raw_transcript', type: 'string', description: 'Extracted text content' },
    { name: 'segments', type: 'array', description: 'Timestamped segments (for video/audio)' },
    { name: 'metadata', type: 'object', description: 'Asset metadata' },
    { name: 'source_type', type: 'string', description: 'Detected source type' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const source = ctx.inputs.source_asset as string;
    const forceType = ctx.inputs.asset_type as string;
    let tokensUsed = 0;

    ctx.logger.info(`Ingesting asset: ${source.slice(0, 100)}...`);

    // Detect asset type
    const sourceType = forceType !== 'auto' ? forceType : detectType(source);

    let rawTranscript = '';
    let segments: Array<{ start: number; end: number; text: string }> = [];
    let metadata: Record<string, unknown> = {};

    switch (sourceType) {
      case 'video':
      case 'audio': {
        ctx.logger.info('Extracting audio and transcribing...');

        // If video, extract audio first
        let audioPath = source;
        if (sourceType === 'video') {
          audioPath = source.replace(extname(source), '.mp3');
          await ctx.tools.ffmpeg.extractAudio(source, audioPath);
          
          // Get video metadata
          metadata = await ctx.tools.ffmpeg.getMetadata(source);
        }

        // Transcribe with Whisper
        const result = await ctx.tools.whisper.transcribe(audioPath, {
          timestamps: true,
          format: 'json',
        });

        rawTranscript = result.text;
        segments = result.segments;
        metadata.duration = result.duration;
        metadata.language = result.language;
        metadata.segmentCount = segments.length;
        
        ctx.logger.info(`Transcription complete: ${rawTranscript.length} chars, ${segments.length} segments`);
        break;
      }

      case 'url': {
        ctx.logger.info('Scraping URL content...');

        rawTranscript = await ctx.tools.browser.scrape(source);
        metadata.sourceUrl = source;
        metadata.wordCount = rawTranscript.split(/\s+/).length;
        
        ctx.logger.info(`Scraped: ${metadata.wordCount} words`);
        break;
      }

      case 'text': {
        // Raw text input
        rawTranscript = source;
        metadata.wordCount = source.split(/\s+/).length;
        break;
      }

      case 'document': {
        if (existsSync(source)) {
          rawTranscript = readFileSync(source, 'utf-8');
          metadata.wordCount = rawTranscript.split(/\s+/).length;
          metadata.filePath = source;
        } else {
          rawTranscript = source;
          metadata.wordCount = source.split(/\s+/).length;
        }
        break;
      }

      default:
        rawTranscript = source;
        metadata.wordCount = source.split(/\s+/).length;
    }

    // Store in memory for future reference
    await ctx.memory.store(
      'ingested_assets',
      `asset-${Date.now()}`,
      rawTranscript.slice(0, 1000),
      { sourceType, ...metadata }
    );

    return {
      output: {
        raw_transcript: rawTranscript,
        segments,
        metadata,
        source_type: sourceType,
      },
      tokensUsed,
      costUnits: 5,
      modelUsed: 'whisper-1',
      durationMs: Date.now() - start,
    };
  },
};

function detectType(source: string): string {
  // URL detection
  if (source.startsWith('http://') || source.startsWith('https://')) {
    // Check if URL points to a video
    const videoPatterns = [/youtube\.com/, /youtu\.be/, /vimeo\.com/, /\.mp4/, /\.mov/];
    for (const p of videoPatterns) {
      if (p.test(source)) return 'video';
    }
    return 'url';
  }

  // File detection
  if (existsSync(source)) {
    const ext = extname(source).toLowerCase();
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
    if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
    if (DOC_EXTENSIONS.includes(ext)) return 'document';
    return 'document';
  }

  // Raw text
  return 'text';
}
