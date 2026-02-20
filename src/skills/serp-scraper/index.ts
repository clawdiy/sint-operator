/**
 * SERP Scraper Skill
 * 
 * Scrapes top 10 Google results for a keyword:
 * - Titles, meta descriptions, heading structure
 * - Content gaps, avg word count, media usage
 * - Internal link patterns
 */

import type { Skill, SkillContext, SkillResult, SERPResult } from '../../core/types.js';

interface SERPAnalysis {
  keyword: string;
  results: SERPResult[];
  avgWordCount: number;
  commonHeadings: string[];
  contentGaps: string[];
  mediaUsage: string;
  linkPatterns: string;
  difficulty: 'low' | 'medium' | 'high';
}

export const serpScraperSkill: Skill = {
  id: 'serp-scraper',
  name: 'SERP Scraper',
  description: 'Scrape top 10 Google results for a keyword. Extract titles, meta descriptions, heading structure. Identify content gaps.',
  version: '1.0.0',
  costUnits: 5,
  inputs: [
    { name: 'keyword', type: 'string', required: true, description: 'Search keyword' },
    { name: 'limit', type: 'number', required: false, description: 'Number of results', default: 10 },
  ],
  outputs: [
    { name: 'serp_data', type: 'object', description: 'SERP analysis results' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const keyword = ctx.inputs.keyword as string;
    const limit = (ctx.inputs.limit as number) ?? 10;

    ctx.logger.info(`Scraping SERP for: ${keyword}`);

    let results: SERPResult[] = [];

    try {
      results = await ctx.tools.browser.serpScrape(keyword);
      results = results.slice(0, limit);
      ctx.logger.info(`Found ${results.length} SERP results`);
    } catch (err) {
      ctx.logger.warn('SERP scrape failed, using LLM analysis', { error: String(err) });
    }

    // Analyze SERP data with LLM for gap identification
    const analysisResult = await ctx.llm.completeJSON<{
      avgWordCount: number;
      commonHeadings: string[];
      contentGaps: string[];
      mediaUsage: string;
      linkPatterns: string;
      difficulty: 'low' | 'medium' | 'high';
    }>(
      `Analyze these Google search results for "${keyword}" and identify content opportunities:

Results:
${results.map((r, i) => `${i + 1}. "${r.title}" — ${r.snippet}`).join('\n')}

Identify:
1. Average estimated word count of top results
2. Common heading patterns (H2/H3 topics)
3. Content gaps — what are these articles NOT covering well?
4. Media usage patterns (images, videos, infographics)
5. Internal/external link patterns
6. Keyword difficulty estimate

JSON: {
  "avgWordCount": 0,
  "commonHeadings": ["H2: Topic"],
  "contentGaps": ["gap1"],
  "mediaUsage": "<description>",
  "linkPatterns": "<description>",
  "difficulty": "low|medium|high"
}`,
      { type: 'object' },
      { tier: 'routine' }
    );

    const analysis: SERPAnalysis = {
      keyword,
      results,
      ...analysisResult.data,
    };

    return {
      output: { serp_data: analysis },
      tokensUsed: analysisResult.meta.totalTokens,
      costUnits: analysisResult.meta.costUnits,
      modelUsed: analysisResult.meta.model,
      durationMs: Date.now() - start,
    };
  },
};
