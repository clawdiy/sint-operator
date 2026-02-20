/**
 * Content Repurpose Skill v2
 * 
 * Takes analyzed content (with content map from analyzer) and generates
 * platform-specific deliverables. Uses content map hooks and themes
 * to create targeted, high-engagement content for each platform.
 * 
 * Triggers: "repurpose", "shred content", "turn video into posts"
 */

import { buildBrandContext } from '../../core/brand/manager.js';
import type { Skill, SkillContext, SkillResult, Platform, ContentFormat } from '../../core/types.js';

interface RepurposeOutput {
  deliverables: Array<{
    platform: Platform;
    format: ContentFormat;
    content: string;
    hashtags?: string[];
    mediaPrompt?: string;
    hook?: string;
    notes?: string;
  }>;
  summary: string;
}

const PLATFORM_SPECS: Record<string, { maxLength: number; format: string; notes: string }> = {
  twitter: {
    maxLength: 280,
    format: 'thread',
    notes: 'Create a 3-5 tweet thread. First tweet must hook. Use line breaks. No hashtags in first tweet. End with CTA.',
  },
  linkedin: {
    maxLength: 3000,
    format: 'text',
    notes: 'Professional tone. Open with bold statement or question. Line breaks every 1-2 sentences. End with question or CTA. 3-5 hashtags at end.',
  },
  instagram: {
    maxLength: 2200,
    format: 'caption',
    notes: 'Engaging caption. Open with hook. Include CTA. 20-30 hashtags in comment block (separated by dots).',
  },
  instagram_reels: {
    maxLength: 2200,
    format: 'script',
    notes: 'Script for 30-90 second reel. Include: hook (first 3 sec), body, CTA. Add visual direction notes.',
  },
  tiktok: {
    maxLength: 300,
    format: 'script',
    notes: 'Script for 15-60 second video. Hook in first 2 seconds. Trending language. 3-5 hashtags.',
  },
  facebook: {
    maxLength: 5000,
    format: 'text',
    notes: 'Conversational tone. Medium length. Include question for engagement. 1-3 hashtags max.',
  },
  blog: {
    maxLength: 50000,
    format: 'article',
    notes: 'Full article with H2/H3 headers, intro, body, conclusion. SEO-optimized. 1000-2000 words.',
  },
  email: {
    maxLength: 10000,
    format: 'newsletter',
    notes: 'Newsletter format with subject line, preview text, body sections, and CTA.',
  },
  telegram: {
    maxLength: 4096,
    format: 'text',
    notes: 'Clean formatting. Use bold and italic markdown. Direct and informative.',
  },
  threads: {
    maxLength: 500,
    format: 'text',
    notes: 'Casual, conversational. Similar to Twitter but slightly longer. Minimal hashtags.',
  },
  youtube: {
    maxLength: 5000,
    format: 'script',
    notes: 'Video description with timestamps, key points, links, and subscribe CTA.',
  },
  youtube_shorts: {
    maxLength: 100,
    format: 'script',
    notes: 'Script for <60 second vertical video. Immediate hook. Fast pacing.',
  },
  pinterest: {
    maxLength: 500,
    format: 'caption',
    notes: 'Pin description with keywords. Actionable, inspiring. Include link CTA.',
  },
};

export const contentRepurposeSkill: Skill = {
  id: 'content-repurpose',
  name: 'Content Repurpose',
  description: 'Repurpose analyzed content into platform-specific deliverables. Uses content map for targeted generation.',
  version: '2.0.0',
  costUnits: 15,
  inputs: [
    { name: 'text', type: 'string', required: true, description: 'Source content to repurpose' },
    { name: 'target_platforms', type: 'array', required: true, description: 'Platforms to generate for' },
    { name: 'content_map', type: 'object', required: false, description: 'Content analysis map from analyzer', default: null },
    { name: 'focus', type: 'string', required: false, description: 'Optional angle/focus', default: '' },
  ],
  outputs: [
    { name: 'deliverables', type: 'array', description: 'Platform-specific content pieces' },
    { name: 'summary', type: 'string', description: 'Summary of generated content' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const text = ctx.inputs.text as string;
    const platforms = ctx.inputs.target_platforms as string[];
    const contentMap = ctx.inputs.content_map as Record<string, unknown> | null;
    const focus = (ctx.inputs.focus as string) ?? '';

    const brandContext = buildBrandContext(ctx.brand);

    // Build platform specs
    const platformInstructions = platforms
      .map(p => {
        const spec = PLATFORM_SPECS[p];
        if (!spec) return null;
        return `\n### ${p.toUpperCase()}\n- Max length: ${spec.maxLength} chars\n- Format: ${spec.format}\n- ${spec.notes}`;
      })
      .filter(Boolean)
      .join('\n');

    // Include content map intelligence if available
    const contentMapSection = contentMap ? `
## Content Analysis (from analyzer):
${JSON.stringify(contentMap, null, 2).slice(0, 5000)}

Use the hooks, themes, and platform suitability scores to guide your content creation.
Prioritize the highest-scoring hooks for each platform.` : '';

    const prompt = `You are a world-class content strategist. Repurpose the following source content into platform-specific deliverables.

${brandContext}

## Source Content:
${text.slice(0, 15000)}

${contentMapSection}

${focus ? `## Focus Angle: ${focus}` : ''}

## Target Platforms and Specifications:
${platformInstructions}

## Instructions:
1. For EACH platform, create content that:
   - Uses the best hook identified for that platform's audience
   - Follows native content patterns and algorithm preferences
   - Respects character/format limits exactly
   - Maintains brand voice
   - Is COMPLETE and READY TO POST
2. For video platforms (TikTok, Reels, Shorts): include a script with visual directions
3. Include a mediaPrompt for each piece describing the ideal visual to pair with it

Respond with JSON:
{
  "deliverables": [
    {
      "platform": "<platform>",
      "format": "<format>",
      "content": "<full ready-to-post content>",
      "hashtags": ["tag1", "tag2"],
      "mediaPrompt": "<description of ideal image/video to create>",
      "hook": "<the hook used>",
      "notes": "<posting tips>"
    }
  ],
  "summary": "<brief summary of what was generated>"
}`;

    const result = await ctx.llm.completeJSON<RepurposeOutput>(prompt, {
      type: 'object',
      properties: { deliverables: { type: 'array' }, summary: { type: 'string' } },
    }, {
      tier: 'complex',
      maxTokens: 8192,
    });

    // Store in memory
    await ctx.memory.store('repurpose', `run-${Date.now()}`, text.slice(0, 500), {
      platforms,
      outputCount: result.data.deliverables.length,
    });

    return {
      output: { ...result.data } as Record<string, unknown>,
      tokensUsed: result.meta.totalTokens,
      costUnits: result.meta.costUnits,
      modelUsed: result.meta.model,
      durationMs: Date.now() - start,
    };
  },
};
