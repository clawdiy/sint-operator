/**
 * Platform Formatter Skill
 * 
 * Takes raw content and reformats it to exact platform specifications.
 * Handles character limits, hashtag rules, media specs, etc.
 */

import { buildBrandContext } from '../../core/brand/manager.js';
import type { Skill, SkillContext, SkillResult, Platform } from '../../core/types.js';

const PLATFORM_RULES: Record<string, {
  maxLength: number;
  hashtagPosition: 'inline' | 'end' | 'comment';
  maxHashtags: number;
  mediaSpecs: string;
  formatting: string;
}> = {
  twitter: {
    maxLength: 280,
    hashtagPosition: 'end',
    maxHashtags: 3,
    mediaSpecs: '1200x675px (16:9), max 4 images',
    formatting: 'No markdown. Short paragraphs. Thread breaks with /1, /2 etc.',
  },
  linkedin: {
    maxLength: 3000,
    hashtagPosition: 'end',
    maxHashtags: 5,
    mediaSpecs: '1200x627px (1.91:1) for links, 1080x1080 for images',
    formatting: 'Use line breaks generously. Bold **text** works. No H1/H2.',
  },
  instagram: {
    maxLength: 2200,
    hashtagPosition: 'comment',
    maxHashtags: 30,
    mediaSpecs: '1080x1080 (square), 1080x1350 (portrait), 1080x566 (landscape)',
    formatting: 'Emojis welcome. Line breaks with dots. Hashtags in first comment.',
  },
  tiktok: {
    maxLength: 300,
    hashtagPosition: 'inline',
    maxHashtags: 5,
    mediaSpecs: '1080x1920 (9:16), max 10 min',
    formatting: 'Super casual. Trending language. Short sentences.',
  },
  facebook: {
    maxLength: 63206,
    hashtagPosition: 'end',
    maxHashtags: 3,
    mediaSpecs: '1200x630px for shares, 1080x1080 for posts',
    formatting: 'Conversational. Questions for engagement. Moderate length.',
  },
  threads: {
    maxLength: 500,
    hashtagPosition: 'end',
    maxHashtags: 5,
    mediaSpecs: '1080x1080 recommended',
    formatting: 'Casual, conversational. Like Twitter but slightly longer.',
  },
  telegram: {
    maxLength: 4096,
    hashtagPosition: 'end',
    maxHashtags: 5,
    mediaSpecs: 'Any image format, inline preview supported',
    formatting: 'Markdown supported: *bold*, _italic_, `code`. Clean and informative.',
  },
};

export const platformFormatterSkill: Skill = {
  id: 'platform-formatter',
  name: 'Platform Formatter',
  description: 'Format content to exact platform specifications',
  version: '1.0.0',
  inputs: [
    { name: 'content', type: 'string', required: true, description: 'Raw content to format' },
    { name: 'platform', type: 'string', required: true, description: 'Target platform' },
    { name: 'content_type', type: 'string', required: false, description: 'Type of content', default: 'post' },
  ],
  outputs: [
    { name: 'formatted', type: 'string', description: 'Platform-formatted content' },
    { name: 'hashtags', type: 'array', description: 'Hashtags (separate if platform requires)' },
    { name: 'mediaSpec', type: 'string', description: 'Recommended media specifications' },
    { name: 'charCount', type: 'number', description: 'Character count' },
    { name: 'withinLimit', type: 'boolean', description: 'Whether content fits platform limit' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const content = ctx.inputs.content as string;
    const platform = ctx.inputs.platform as string;

    const rules = PLATFORM_RULES[platform];
    if (!rules) {
      return {
        output: {
          formatted: content,
          hashtags: [],
          mediaSpec: '',
          charCount: content.length,
          withinLimit: true,
        },
        tokensUsed: 0,
        durationMs: Date.now() - start,
      };
    }

    const brandContext = buildBrandContext(ctx.brand);

    const prompt = `Reformat this content for ${platform.toUpperCase()}.

${brandContext}

## Platform Rules:
- Max length: ${rules.maxLength} characters
- Hashtag placement: ${rules.hashtagPosition}
- Max hashtags: ${rules.maxHashtags}
- Formatting: ${rules.formatting}

## Source Content:
${content}

## Output Rules:
1. Must be UNDER ${rules.maxLength} characters (not including hashtags if they go in comments)
2. Must feel native to ${platform} — not like a copy-paste from another platform
3. Maintain brand voice
4. Optimize for ${platform}'s algorithm (engagement signals)

Respond with JSON:
{
  "formatted": "<the formatted content ready to post>",
  "hashtags": ["tag1", "tag2"],
  "notes": "<any tips for posting>"
}`;

    const result = await ctx.llm.completeJSON<{
      formatted: string;
      hashtags: string[];
      notes: string;
    }>(prompt, { type: 'object' });

    return {
      output: {
        formatted: result.formatted,
        hashtags: result.hashtags,
        mediaSpec: rules.mediaSpecs,
        charCount: result.formatted.length,
        withinLimit: result.formatted.length <= rules.maxLength,
        notes: result.notes,
      },
      tokensUsed: 0,
      durationMs: Date.now() - start,
    };
  },
};
