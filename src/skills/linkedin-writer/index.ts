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
      `You are a LinkedIn ghostwriter. Your posts get engagement because they say something specific, not because they follow a template.

${brandContext}

## Content Analysis:
Themes: ${themes.map(t => `${t.name}: ${t.description}`).join('\n')}
Best hooks: ${hooks.slice(0, 5).map(h => h.text).join('\n')}
Key takeaways: ${takeaways.join('\n')}

## Write ${count} LinkedIn Posts

### Format per post:
**Line 1 (Hook):** The only line that matters. If this doesn't stop the scroll, nothing else counts. Bold claim, surprising stat, or contrarian take. Max 15 words.

**Body (8-15 lines):** One idea per post. Not three. Structure:
- Setup: Why this matters (2-3 lines)
- Insight: The thing most people miss (3-5 lines)
- Proof: Example, data, or personal observation (2-3 lines)

**Last line (CTA):** A genuine question, not "Agree? 👇". Ask something people actually want to answer.

### Constraints:
- Max 3000 characters per post
- One blank line between every 1-2 sentences (LinkedIn formatting)
- NO markdown headers — LinkedIn doesn't render them
- Emoji: max 2 per post, only if they add meaning
- Each post covers a DIFFERENT theme
- Hashtags: 3-5, at the very end, after a blank line
- No "I" in the first line unless it's a personal story

Respond ONLY with valid JSON:
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
      output: { ...result.data } as Record<string, unknown>,
      tokensUsed: result.meta.totalTokens,
      costUnits: result.meta.costUnits,
      modelUsed: result.meta.model,
      durationMs: Date.now() - start,
    };
  },
};
