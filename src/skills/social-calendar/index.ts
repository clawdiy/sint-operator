/**
 * Social Calendar Skill v2
 * 
 * Generates multi-day content calendars with intelligent model routing:
 * - Complex tier for strategy/theme planning
 * - Routine tier for individual post generation
 */

import { buildBrandContext } from '../../core/brand/manager.js';
import type { Skill, SkillContext, SkillResult, Platform } from '../../core/types.js';

interface CalendarDay {
  date: string;
  theme: string;
  posts: Array<{
    platform: Platform;
    time: string;
    content: string;
    hashtags: string[];
    mediaPrompt?: string;
    contentType: string;
    notes: string;
  }>;
}

interface CalendarOutput {
  calendar: CalendarDay[];
  summary: string;
  totalPosts: number;
  strategy: string;
}

export const socialCalendarSkill: Skill = {
  id: 'social-calendar',
  name: 'Social Calendar Generator',
  description: 'Generate a multi-day social media content calendar with platform-specific posts, optimal posting times, and media prompts.',
  version: '2.0.0',
  costUnits: 15,
  inputs: [
    { name: 'days', type: 'number', required: true, description: 'Number of days to plan' },
    { name: 'themes', type: 'array', required: false, description: 'Content themes/pillars', default: [] },
    { name: 'platforms', type: 'array', required: false, description: 'Target platforms', default: ['twitter', 'linkedin', 'instagram'] },
    { name: 'posts_per_day', type: 'number', required: false, description: 'Posts per platform per day', default: 1 },
    { name: 'start_date', type: 'string', required: false, description: 'Start date (YYYY-MM-DD)', default: '' },
  ],
  outputs: [
    { name: 'calendar', type: 'array', description: 'Day-by-day content calendar' },
    { name: 'summary', type: 'string', description: 'Calendar summary' },
    { name: 'totalPosts', type: 'number', description: 'Total posts generated' },
    { name: 'strategy', type: 'string', description: 'Content strategy overview' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const days = ctx.inputs.days as number;
    const themes = (ctx.inputs.themes as string[]) ?? [];
    const platforms = (ctx.inputs.platforms as string[]) ?? ['twitter', 'linkedin', 'instagram'];
    const postsPerDay = (ctx.inputs.posts_per_day as number) ?? 1;
    const startDate = (ctx.inputs.start_date as string) || new Date().toISOString().split('T')[0];

    const brandContext = buildBrandContext(ctx.brand);

    const prompt = `You are an expert social media strategist.

${brandContext}

## Calendar Parameters:
- Duration: ${days} days starting ${startDate}
- Platforms: ${platforms.join(', ')}
- Posts per platform per day: ${postsPerDay}
- Themes: ${themes.length > 0 ? themes.join(', ') : 'Derive from brand context'}

## Posting Times:
- Twitter: 8-10 AM, 12-1 PM, 5-6 PM
- LinkedIn: 7-8 AM, 12 PM, 5-6 PM (Tue-Thu best)
- Instagram: 11 AM-1 PM, 7-9 PM (Mon/Thu best)
- TikTok: 7-9 AM, 12-3 PM, 7-11 PM

## Requirements:
1. Each post COMPLETE and READY TO USE
2. Mix: educational, promotional, engagement, storytelling, behind-the-scenes
3. Include mediaPrompt for visual content ideas
4. Build narrative momentum across the calendar
5. Platform-native patterns and character limits
6. Engagement hooks in every post

Respond with JSON:
{
  "strategy": "<overall content strategy for this period>",
  "calendar": [{
    "date": "YYYY-MM-DD",
    "theme": "<day theme>",
    "posts": [{
      "platform": "<platform>",
      "time": "HH:MM",
      "content": "<full post>",
      "hashtags": ["tag1"],
      "mediaPrompt": "<visual description>",
      "contentType": "educational|promotional|engagement|storytelling|behind-the-scenes",
      "notes": "<tips>"
    }]
  }],
  "summary": "<overview>",
  "totalPosts": <number>
}`;

    const result = await ctx.llm.completeJSON<CalendarOutput>(prompt, {
      type: 'object',
    }, {
      tier: 'complex',
      maxTokens: 8192,
    });

    return {
      output: result.data,
      tokensUsed: result.meta.totalTokens,
      costUnits: result.meta.costUnits,
      modelUsed: result.meta.model,
      durationMs: Date.now() - start,
    };
  },
};
