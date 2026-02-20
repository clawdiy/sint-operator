/**
 * LinkedIn Writer Skill
 * 
 * Generates 3 LinkedIn posts from content map themes.
 * Each post has: hook, insight, CTA, proper formatting.
 * Uses routine tier (Sonnet) — structured generation, not strategy.
 */

import { buildBrandContext } from '../../core/brand/manager.js';
import type { Skill, SkillContext, SkillResult } from '../../core/types.js';

interface LinkedInOutput {
  posts: Array<{
    theme: string;
    content: string;
    hashtags: string[];
    hook: string;
    cta: string;
    charCount: number;
    notes: string;
  }>;
}

export const linkedinWriterSkill: Skill = {
  id: 'linkedin-writer',
  name: 'LinkedIn Writer',
  description: 'Generate LinkedIn posts from content map themes with hooks, insights, CTAs, and brand-compliant formatting.',
  version: '1.0.0',
  costUnits: 8,
  inputs: [
    { name: 'content_map', type: 'object', required: true, description: 'Content analysis map with themes' },
    { name: 'count', type: 'number', required: false, description: 'Number of posts to generate', default: 3 },
  ],
  outputs: [
    { name: 'posts', type: 'array', description: 'LinkedIn post drafts' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const contentMap = ctx.inputs.content_map as Record<string, unknown>;
    const count = (ctx.inputs.count as number) ?? 3;

    const brandContext = buildBrandContext(ctx.brand);
    const themes = (contentMap.themes as Array<{ name: string; description: string }>) ?? [];
    const hooks = (contentMap.hooks as Array<{ text: string; hookType: string }>) ?? [];
    const takeaways = (contentMap.keyTakeaways as string[]) ?? [];

    const result = await ctx.llm.completeJSON<LinkedInOutput>(
      `You are a LinkedIn content expert writing for a brand.

${brandContext}

## Content Analysis:
Themes: ${themes.map(t => `${t.name}: ${t.description}`).join('\n')}
Best hooks: ${hooks.slice(0, 5).map(h => h.text).join('\n')}
Key takeaways: ${takeaways.join('\n')}

## Task:
Write ${count} LinkedIn posts. Each post must:

1. **Hook** (first line): Bold statement, question, or contrarian take. This determines if someone stops scrolling.
2. **Body** (3-5 paragraphs): Key insight with supporting points. Use line breaks after every 1-2 sentences.
3. **CTA** (last line): Question or call-to-action for engagement.
4. **Hashtags**: 3-5 relevant hashtags at the very end.

## LinkedIn Formatting Rules:
- Max 3000 characters
- Line breaks are your friend — use them generously
- No markdown headers (LinkedIn doesn't render them)
- Emoji: use sparingly and only if brand allows
- Each post should focus on a different theme
- Professional but not corporate

Respond with JSON:
{
  "posts": [{
    "theme": "<theme name>",
    "content": "<full ready-to-post LinkedIn content>",
    "hashtags": ["tag1", "tag2"],
    "hook": "<the opening hook line>",
    "cta": "<the closing CTA>",
    "charCount": <number>,
    "notes": "<posting tips: best day/time, engagement strategy>"
  }]
}`,
      { type: 'object' },
      { tier: 'routine', maxTokens: 4096 }
    );

    return {
      output: result.data,
      tokensUsed: result.meta.totalTokens,
      costUnits: result.meta.costUnits,
      modelUsed: result.meta.model,
      durationMs: Date.now() - start,
    };
  },
};
