/**
 * Social Calendar Skill
 * 
 * Generates a multi-day social media content calendar with
 * platform-specific posts, optimal posting times, and themes.
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
}

export const socialCalendarSkill: Skill = {
  id: 'social-calendar',
  name: 'Social Calendar Generator',
  description: 'Generate a multi-day social media content calendar',
  version: '1.0.0',
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
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const days = ctx.inputs.days as number;
    const themes = (ctx.inputs.themes as string[]) ?? [];
    const platforms = (ctx.inputs.platforms as string[]) ?? ['twitter', 'linkedin', 'instagram'];
    const postsPerDay = (ctx.inputs.posts_per_day as number) ?? 1;
    const startDate = (ctx.inputs.start_date as string) || new Date().toISOString().split('T')[0];

    const brandContext = buildBrandContext(ctx.brand);

    const prompt = `You are an expert social media strategist planning a content calendar.

${brandContext}

## Calendar Parameters:
- Duration: ${days} days starting from ${startDate}
- Platforms: ${platforms.join(', ')}
- Posts per platform per day: ${postsPerDay}
- Content themes/pillars: ${themes.length > 0 ? themes.join(', ') : 'Derive from brand context'}

## Platform Best Posting Times:
- Twitter: 8-10 AM, 12-1 PM, 5-6 PM (user's timezone)
- LinkedIn: 7-8 AM, 12 PM, 5-6 PM (Tue-Thu best)
- Instagram: 11 AM-1 PM, 7-9 PM (Mon/Thu best)
- TikTok: 7-9 AM, 12-3 PM, 7-11 PM
- Facebook: 1-4 PM (best engagement)

## Instructions:
1. Create a diverse mix of content types (educational, promotional, engagement, storytelling)
2. Each post must be COMPLETE and READY TO USE — no placeholders
3. Include image/media prompts for visual platforms
4. Vary content themes across the week
5. Include engagement hooks (questions, polls, CTAs)
6. Respect each platform's character limits and native patterns
7. Build narrative momentum across the calendar

Respond with JSON:
{
  "calendar": [
    {
      "date": "YYYY-MM-DD",
      "theme": "<day's theme>",
      "posts": [
        {
          "platform": "<platform>",
          "time": "HH:MM",
          "content": "<full ready-to-post content>",
          "hashtags": ["tag1", "tag2"],
          "mediaPrompt": "<description of ideal image/video to pair>",
          "contentType": "educational|promotional|engagement|storytelling|behind-the-scenes",
          "notes": "<posting tips>"
        }
      ]
    }
  ],
  "summary": "<calendar overview>",
  "totalPosts": <number>
}`;

    const result = await ctx.llm.completeJSON<CalendarOutput>(prompt, {
      type: 'object',
    }, { maxTokens: 8192 });

    return {
      output: result,
      tokensUsed: 0,
      durationMs: Date.now() - start,
    };
  },
};
