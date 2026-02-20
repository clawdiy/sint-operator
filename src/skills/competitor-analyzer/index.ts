/**
 * Competitor Content Analyzer Skill
 * 
 * Analyzes competitor content strategy from their social presence.
 * Takes competitor names/URLs → outputs strategy analysis, content gaps, and opportunities.
 * Uses complex tier for strategic analysis.
 */

import { buildBrandContext } from '../../core/brand/manager.js';
import type { Skill, SkillContext, SkillResult } from '../../core/types.js';

interface CompetitorAnalysis {
  competitors: Array<{
    name: string;
    contentStrategy: {
      primaryPlatforms: string[];
      postingFrequency: string;
      contentTypes: string[];
      topicFocus: string[];
      toneDescription: string;
    };
    strengths: string[];
    weaknesses: string[];
    topPerformingContent: string[];
    audienceEngagement: string;
  }>;
  gaps: Array<{
    gap: string;
    opportunity: string;
    difficulty: 'easy' | 'medium' | 'hard';
    platforms: string[];
  }>;
  recommendations: Array<{
    action: string;
    rationale: string;
    priority: 'high' | 'medium' | 'low';
    timeline: string;
  }>;
  summary: string;
}

export const competitorAnalyzerSkill: Skill = {
  id: 'competitor-analyzer',
  name: 'Competitor Content Analyzer',
  description: 'Analyze competitor content strategies and identify gaps and opportunities for your brand.',
  version: '1.0.0',
  costUnits: 15,
  inputs: [
    { name: 'competitors', type: 'array', required: true, description: 'Competitor names or website URLs' },
    { name: 'platforms', type: 'array', required: false, description: 'Platforms to analyze', default: ['twitter', 'linkedin'] },
    { name: 'focus_area', type: 'string', required: false, description: 'Specific area to focus analysis on', default: '' },
  ],
  outputs: [
    { name: 'analysis', type: 'object', description: 'Complete competitor content analysis' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const competitors = ctx.inputs.competitors as string[];
    const platforms = (ctx.inputs.platforms as string[]) ?? ['twitter', 'linkedin'];
    const focusArea = (ctx.inputs.focus_area as string) ?? '';

    const brandContext = buildBrandContext(ctx.brand);

    // Try to scrape competitor websites for context
    let scrapedContext = '';
    for (const comp of competitors.slice(0, 3)) {
      if (comp.startsWith('http')) {
        try {
          const text = await ctx.tools.browser.scrape(comp);
          scrapedContext += `\n## ${comp}:\n${text.slice(0, 3000)}\n`;
        } catch {
          ctx.logger.warn(`Could not scrape ${comp}`);
        }
      }
    }

    const result = await ctx.llm.completeJSON<CompetitorAnalysis>(
      `You are a competitive intelligence analyst specializing in content strategy.

${brandContext}

## Your Brand's Keywords: ${ctx.brand.keywords.join(', ')}
## Your Brand's Platforms: ${ctx.brand.platforms.filter(p => p.enabled).map(p => p.platform).join(', ')}

## Competitors to Analyze
${competitors.map((c, i) => `${i + 1}. ${c}`).join('\n')}

## Platforms to Focus On: ${platforms.join(', ')}
${focusArea ? `## Focus Area: ${focusArea}` : ''}

${scrapedContext ? `## Scraped Competitor Data:\n${scrapedContext}` : ''}

## Analysis Rules
1. For each competitor, analyze their content strategy across the specified platforms.
2. Be specific about content types (threads, carousels, long-form, video, memes, etc.).
3. Strengths and weaknesses must be actionable — not "good content" but "strong data-driven threads that consistently get 50+ replies."
4. Content gaps must be REAL opportunities — things the market wants that nobody is doing well.
5. Recommendations should have clear timelines and priority levels.
6. If you don't have enough data on a competitor, say so. Don't fabricate engagement metrics.
7. Difficulty ratings: easy = can start today with existing resources, medium = needs some prep/research, hard = requires new capabilities or significant effort.

Respond ONLY with valid JSON:
{
  "competitors": [{
    "name": "",
    "contentStrategy": {
      "primaryPlatforms": [],
      "postingFrequency": "",
      "contentTypes": [],
      "topicFocus": [],
      "toneDescription": ""
    },
    "strengths": [],
    "weaknesses": [],
    "topPerformingContent": ["description of their best content patterns"],
    "audienceEngagement": ""
  }],
  "gaps": [{
    "gap": "specific content gap",
    "opportunity": "how your brand can fill it",
    "difficulty": "easy|medium|hard",
    "platforms": ["where to execute"]
  }],
  "recommendations": [{
    "action": "specific action",
    "rationale": "why this matters",
    "priority": "high|medium|low",
    "timeline": "this week|this month|this quarter"
  }],
  "summary": "2-3 sentence overview"
}`,
      { type: 'object' },
      { tier: 'complex', maxTokens: 6144, temperature: 0.3 },
    );

    return {
      output: { analysis: result.data },
      tokensUsed: result.meta.totalTokens,
      costUnits: result.meta.costUnits,
      modelUsed: result.meta.model,
      durationMs: Date.now() - start,
    };
  },
};
