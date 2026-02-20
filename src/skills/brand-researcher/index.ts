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
      `You are a world-class brand strategist and visual identity expert.

## Task:
Create a comprehensive brand direction document for a new brand in the **${industry}** industry.

${competitors.length > 0 ? `## Competitors to Analyze:\n${competitors.join(', ')}` : ''}

${Object.keys(brandQuiz).length > 0 ? `## Brand Personality Quiz Results:\n${JSON.stringify(brandQuiz, null, 2)}` : ''}

## Requirements:

1. **Industry Trends**: Current visual and branding trends in ${industry}
2. **Competitor Analysis**: For each competitor, analyze their visual language, strengths, weaknesses
3. **Color Theory**: Recommend a color direction with psychology rationale
   - Consider industry norms, target audience, emotional associations
   - Apply color psychology (blue=trust, red=energy, green=growth, etc.)
4. **Shape Language**: Recommend shapes/forms based on brand personality
   - Geometric = precision/tech, Organic = natural/friendly, Angular = bold/modern
5. **Brand Direction**: Overall positioning, personality traits, visual strategy, differentiators

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
