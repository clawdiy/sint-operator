/**
 * Brand Researcher Skill
 * 
 * Research branding trends for industry, analyze competitor visual language,
 * apply color theory + shape psychology. Uses Opus (complex tier).
 */

import { buildBrandContext } from '../../core/brand/manager.js';
import type { Skill, SkillContext, SkillResult } from '../../core/types.js';

interface BrandDirection {
  industryTrends: string[];
  competitorAnalysis: Array<{
    name: string;
    visualLanguage: string;
    strengths: string[];
    weaknesses: string[];
  }>;
  colorTheory: {
    recommendedPalette: string;
    psychologyRationale: string;
    moodAssociations: string[];
  };
  shapeLanguage: {
    recommendedShapes: string[];
    rationale: string;
  };
  brandDirection: {
    positioning: string;
    personality: string[];
    visualStrategy: string;
    differentiators: string[];
  };
  rationale: string;
}

export const brandResearcherSkill: Skill = {
  id: 'brand-researcher',
  name: 'Brand Researcher',
  description: 'Research branding trends for industry, analyze competitor visual language, apply color theory and shape psychology to brand quiz results.',
  version: '1.0.0',
  costUnits: 15,
  inputs: [
    { name: 'industry', type: 'string', required: true, description: 'Target industry' },
    { name: 'brand_quiz', type: 'object', required: false, description: 'Brand personality quiz responses', default: {} },
    { name: 'competitors', type: 'array', required: false, description: 'Competitor names to analyze', default: [] },
  ],
  outputs: [
    { name: 'brand_direction', type: 'object', description: 'Complete brand direction document' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const industry = ctx.inputs.industry as string;
    const brandQuiz = ctx.inputs.brand_quiz as Record<string, unknown>;
    const competitors = (ctx.inputs.competitors as string[]) ?? [];

    const result = await ctx.llm.completeJSON<BrandDirection>(
      `You are a brand strategist creating a data-driven brand direction.

## Task:
Create a comprehensive brand direction document for a new brand in the **${industry}** industry.

${competitors.length > 0 ? `## Competitors to Analyze:\n${competitors.join(', ')}` : ''}

${Object.keys(brandQuiz).length > 0 ? `## Brand Personality Quiz Results:\n${JSON.stringify(brandQuiz, null, 2)}` : ''}

## Deliverables

### 1. Industry Trends (visual + messaging)
Current trends in ${industry} branding. Not generic design trends — specific to this industry's audience expectations.

### 2. Competitor Analysis
For each competitor: visual language, strengths, and vulnerabilities. If you don't have real data on a competitor, say so — don't fabricate brand audits.

### 3. Color Direction
Recommend a palette with psychology rationale. Go beyond "blue = trust." Explain why THIS shade for THIS audience in THIS competitive landscape.

### 4. Shape Language
Geometric (precision/tech), organic (natural/friendly), angular (bold/disruptive), mixed. Tie to brand personality, not trends.

### 5. Brand Direction
Positioning statement, 3-5 personality traits, visual strategy, and 2-3 differentiators that are DEFENSIBLE (not "high quality" — everyone says that).

Respond with JSON:
{
  "industryTrends": ["trend1", "trend2"],
  "competitorAnalysis": [{"name": "", "visualLanguage": "", "strengths": [], "weaknesses": []}],
  "colorTheory": {
    "recommendedPalette": "<description>",
    "psychologyRationale": "<why these colors>",
    "moodAssociations": ["bold", "trustworthy"]
  },
  "shapeLanguage": {
    "recommendedShapes": ["geometric", "minimal"],
    "rationale": "<why>"
  },
  "brandDirection": {
    "positioning": "<market position statement>",
    "personality": ["trait1", "trait2"],
    "visualStrategy": "<overall visual approach>",
    "differentiators": ["diff1", "diff2"]
  },
  "rationale": "<comprehensive rationale tying everything together>"
}`,
      { type: 'object' },
      { tier: 'complex', maxTokens: 4096 }
    );

    return {
      output: { brand_direction: result.data },
      tokensUsed: result.meta.totalTokens,
      costUnits: result.meta.costUnits,
      modelUsed: result.meta.model,
      durationMs: Date.now() - start,
    };
  },
};
