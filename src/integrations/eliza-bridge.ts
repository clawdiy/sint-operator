/**
 * Eliza OS Bridge — Social Intelligence Layer
 * 
 * Integrates Eliza OS character system for brand voice in social publishing.
 * OpenClaw is the execution engine; Eliza provides personality + social connectors.
 * 
 * Design: Wrapper pattern, not fork. Either can be swapped independently.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { BrandProfile, Platform, Logger } from '../core/types.js';

// ─── Eliza Character Format ──────────────────────────────────

export interface ElizaCharacter {
  name: string;
  bio: string;
  style: {
    all: string[];
    twitter?: string[];
    linkedin?: string[];
    tiktok?: string[];
    discord?: string[];
    telegram?: string[];
  };
  topics: string[];
  adjectives: string[];
  lore?: string[];
  messageExamples?: Array<{ user: string; content: string }[]>;
  postExamples?: string[];
}

// ─── Brand → Eliza Character Conversion ─────────────────────

/**
 * Converts a SINT BrandProfile into an Eliza OS character file.
 * This is the bridge between SINT's brand system and Eliza's personality engine.
 */
export function brandToElizaCharacter(brand: BrandProfile): ElizaCharacter {
  const character: ElizaCharacter = {
    name: `${brand.name} Brand Voice`,
    bio: brand.voice.style,
    style: {
      all: [
        ...brand.voice.tone.map(t => `${t} tone`),
        ...brand.voice.doNot.map(d => `Never: ${d}`),
      ],
    },
    topics: brand.keywords,
    adjectives: brand.voice.tone,
  };

  // Platform-specific style rules
  const platformStyles: Record<string, string[]> = {
    twitter: [
      'Thread-friendly format',
      'Under 280 chars per tweet',
      'Hook in first tweet',
    ],
    linkedin: [
      'Thought leadership tone',
      'Line breaks every 1-2 sentences',
      '3-5 paragraphs typical',
      'Professional but not corporate',
    ],
    tiktok: [
      'Hook in first 2 seconds',
      'Conversational and casual',
      'Trend-aware language',
      'Short punchy sentences',
    ],
    discord: [
      'Community-first tone',
      'Use reactions and emojis naturally',
      'Engage directly with members',
    ],
    telegram: [
      'Clean markdown formatting',
      'Direct and informative',
      'Bold for emphasis',
    ],
  };

  for (const [platform, styles] of Object.entries(platformStyles)) {
    const brandPlatform = brand.platforms.find(p => p.platform === platform && p.enabled);
    if (brandPlatform) {
      (character.style as Record<string, string[]>)[platform] = styles;
    }
  }

  // Add vocabulary as lore
  if (brand.voice.vocabulary.length > 0) {
    character.lore = [
      `Preferred terminology: ${brand.voice.vocabulary.join(', ')}`,
      `Competitors to differentiate from: ${brand.competitors.join(', ')}`,
    ];
  }

  // Add examples as post examples
  if (brand.voice.examples.length > 0) {
    character.postExamples = brand.voice.examples;
  }

  return character;
}

/**
 * Export character file for Eliza OS consumption.
 */
export function exportElizaCharacter(
  brand: BrandProfile,
  outputDir: string,
  logger?: Logger
): string {
  const character = brandToElizaCharacter(brand);
  
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const filename = `${brand.id}-character.json`;
  const outputPath = join(outputDir, filename);
  writeFileSync(outputPath, JSON.stringify(character, null, 2));
  
  logger?.info(`Exported Eliza character: ${outputPath}`, { brand: brand.name });
  return outputPath;
}

/**
 * Load an Eliza character file and convert back to brand voice overlay.
 */
export function loadElizaCharacter(path: string): ElizaCharacter | null {
  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as ElizaCharacter;
  } catch {
    return null;
  }
}

// ─── Social Publishing Interface ─────────────────────────────

/**
 * Represents a post ready for social publishing via Eliza OS connectors.
 */
export interface SocialPost {
  platform: Platform;
  content: string;
  media?: string[];
  hashtags?: string[];
  scheduledAt?: string;
  character: string;  // character file reference
  metadata?: Record<string, unknown>;
}

/**
 * Queue posts for Eliza OS social publishing.
 * In the MVP, this writes to a queue file that Eliza picks up.
 * In production, this would be an API call to Eliza's runtime.
 */
export function queueForPublishing(
  posts: SocialPost[],
  queueDir: string,
  logger?: Logger
): string {
  if (!existsSync(queueDir)) {
    mkdirSync(queueDir, { recursive: true });
  }

  const batchId = `batch-${Date.now()}`;
  const queueFile = join(queueDir, `${batchId}.json`);
  
  writeFileSync(queueFile, JSON.stringify({
    batchId,
    createdAt: new Date().toISOString(),
    posts,
    status: 'pending_approval',
  }, null, 2));

  logger?.info(`Queued ${posts.length} posts for publishing`, { batchId });
  return batchId;
}
