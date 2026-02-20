/**
 * Whisper Service — Audio transcription via OpenAI Whisper API
 * 
 * Converts video/audio to timestamped transcripts for content repurposing.
 */

import { createReadStream } from 'fs';
import OpenAI from 'openai';
import type { WhisperService, TranscribeOptions, TranscriptResult, TimestampedSegment } from '../../core/types.js';

export class WhisperServiceImpl implements WhisperService {
  private client: OpenAI;

  constructor(apiKey: string, baseUrl?: string) {
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
  }

  async transcribe(audioPath: string, options?: TranscribeOptions): Promise<TranscriptResult> {
    const file = createReadStream(audioPath);

    // Get verbose JSON for timestamps
    const response = await this.client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: options?.language,
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    const segments: TimestampedSegment[] = (response as any).segments?.map((seg: any) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
    })) ?? [];

    return {
      text: response.text,
      segments,
      language: (response as any).language ?? options?.language ?? 'en',
      duration: segments.length > 0 ? segments[segments.length - 1].end : 0,
    };
  }
}
