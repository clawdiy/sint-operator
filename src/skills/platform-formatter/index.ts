/**
 * Platform Formatter Skill v2
 * 
 * Reformats content to exact platform specifications.
 * Uses routine tier (Sonnet) — this is a formatting task, not creative.
 */

import { buildBrandContext } from '../../core/brand/manager.js';
import type { Skill, SkillContext, SkillResult } from '../../core/types.js';

const PLATFORM_RULES: Record<string, {
  maxLength: number;
  hashtagPosition: 'inline' | 'end' | 'comment';
  maxHashtags: number;
  mediaSpecs: string;
  formatting: string;
}> = {
  twitter: { maxLength: 280, hashtagPosition: 'end', maxHashtags: 3, mediaSpecs: '1200x675 (16:9)', formatting: 'No markdown. Short lines. Thread: /1 /2 etc.' },
  linkedin: { maxLength: 3000, hashtagPosition: 'end', maxHashtags: 5, mediaSpecs: '1200x627 (1.91:1)', formatting: 'Line breaks generous. **Bold** works.' },
  instagram: { maxLength: 2200, hashtagPosition: 'comment', maxHashtags: 30, mediaSpecs: '1080x1080 (square)', formatting: 'Emojis ok. Hashtags in first comment.' },
  instagram_reels: { maxLength: 2200, hashtagPosition: 'comment', maxHashtags: 30, mediaSpecs: '1080x1920 (9:16)', formatting: 'Script format with visual cues.' },
  tiktok: { maxLength: 300, hashtagPosition: 'inline', maxHashtags: 5, mediaSpecs: '1080x1920 (9:16)', formatting: 'Super casual. Trending language.' },
  facebook: { maxLength: 63206, hashtagPosition: 'end', maxHashtags: 3, mediaSpecs: '1200x630', formatting: 'Conversational. Questions for engagement.' },
  threads: { maxLength: 500, hashtagPosition: 'end', maxHashtags: 5, mediaSpecs: '1080x1080', formatting: 'Casual, like Twitter but longer.' },
  telegram: { maxLength: 4096, hashtagPosition: 'end', maxHashtags: 5, mediaSpecs: 'Any format', formatting: '*bold* _italic_ `code` markdown.' },
  youtube: { maxLength: 5000, hashtagPosition: 'end', maxHashtags: 15, mediaSpecs: '1280x720 min', formatting: 'Description with timestamps.' },
  pinterest: { maxLength: 500, hashtagPosition: 'end', maxHashtags: 20, mediaSpecs: '1000x1500 (2:3)', formatting: 'Keyword-rich. Actionable.' },
};

export const platformFormatterSkill: Skill = {
  id: 'platform-formatter',
  name: 'Platform Formatter',
  description: 'Format content to exact platform specifications including character limits, hashtag rules, and media specs.',
  version: '2.0.0',
  costUnits: 3,
  inputs: [
    { name: 'content', type: 'string', required: true, description: 'Raw content to format' },
    { name: 'platform', type: 'string', required: true, description: 'Target platform' },
  ],
  outputs: [
    { name: 'formatted', type: 'string', description: 'Platform-formatted content' },
    { name: 'hashtags', type: 'array', description: 'Hashtags' },
    { name: 'mediaSpec', type: 'string', description: 'Media specifications' },
    { name: 'charCount', type: 'number', description: 'Character count' },
    { name: 'withinLimit', type: 'boolean', description: 'Fits platform limit' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const content = ctx.inputs.content as string;
    const platform = ctx.inputs.platform as string;
    const rules = PLATFORM_RULES[platform];

    if (!rules) {
      return {
        output: { formatted: content, hashtags: [], mediaSpec: '', charCount: content.length, withinLimit: true },
        tokensUsed: 0, costUnits: 0, modelUsed: 'none', durationMs: Date.now() - start,
      };
    }

    const brandContext = buildBrandContext(ctx.brand);

    const result = await ctx.llm.completeJSON<{
      formatted: string;
      hashtags: string[];
      notes: string;
    }>(`Reformat this content for ${platform.toUpperCase()}.

${brandContext}

Platform: max ${rules.maxLength} chars, hashtags: ${rules.hashtagPosition}, max ${rules.maxHashtags} hashtags.
Formatting: ${rules.formatting}

Source:
${content}

Must be UNDER ${rules.maxLength} chars, native to ${platform}, maintain brand voice.

JSON: { "formatted": "<content>", "hashtags": ["tag1"], "notes": "<tips>" }`,
      { type: 'object' },
      { tier: 'routine' }  // Formatting = routine task
    );

    return {
      output: {
        formatted: result.data.formatted,
        hashtags: result.data.hashtags,
        mediaSpec: rules.mediaSpecs,
        charCount: result.data.formatted.length,
        withinLimit: result.data.formatted.length <= rules.maxLength,
        notes: result.data.notes,
      },
      tokensUsed: result.meta.totalTokens,
      costUnits: result.meta.costUnits,
      modelUsed: result.meta.model,
      durationMs: Date.now() - start,
    };
  },
};
