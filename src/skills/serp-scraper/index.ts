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

Analyze:
1. **avgWordCount** — Estimate based on snippet depth and ranking positions. Top 3 results indicate the competitive bar.
2. **commonHeadings** — H2/H3 topics appearing across multiple results. Format: "H2: Topic Name"
3. **contentGaps** — Questions a searcher has that NONE of these results answer well. Be specific. "More examples" is lazy. "Step-by-step migration guide from X to Y" is useful.
4. **mediaUsage** — Do top results use video, infographics, comparison tables? What's missing?
5. **linkPatterns** — Do they cite studies, link to tools, reference official docs?
6. **difficulty** — low (thin content, few authoritative sites), medium (decent but beatable), high (strong domains with deep content)

Respond ONLY with valid JSON:
{
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
