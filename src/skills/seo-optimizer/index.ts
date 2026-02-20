/**
 * SEO Optimizer Skill
 * 
 * Post-processing for blog content:
 * - Schema markup (Article + FAQ)
 * - Meta title (<60 chars) + description (<160 chars)
 * - Image alt-text suggestions
 * - Keyword density check (target 1-2%)
 * - SEO score card
 */

import type { Skill, SkillContext, SkillResult } from '../../core/types.js';

interface SEOPackage {
  metaTitle: string;
  metaDescription: string;
  schemaMarkup: Record<string, unknown>;
  faqSchema: Record<string, unknown> | null;
  altTexts: string[];
  keywordDensity: { keyword: string; density: number; status: 'low' | 'optimal' | 'high' };
  scoreCard: {
    overall: number;
    titleScore: number;
    metaScore: number;
    contentScore: number;
    keywordScore: number;
    readabilityScore: number;
    structureScore: number;
    issues: string[];
    recommendations: string[];
  };
}

export const seoOptimizerSkill: Skill = {
  id: 'seo-optimizer',
  name: 'SEO Optimizer',
  description: 'Generate schema markup, meta tags, alt-text suggestions, keyword density check, and SEO score card for blog content.',
  version: '1.0.0',
  costUnits: 5,
  inputs: [
    { name: 'blog_draft', type: 'object', required: true, description: 'Blog draft content' },
    { name: 'keyword', type: 'string', required: false, description: 'Primary keyword', default: '' },
  ],
  outputs: [
    { name: 'seo_package', type: 'object', description: 'Complete SEO optimization package' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const blogDraft = ctx.inputs.blog_draft as Record<string, unknown>;
    const content = (blogDraft.content as string) ?? '';
    const title = (blogDraft.title as string) ?? '';
    const keyword = (ctx.inputs.keyword as string) || (blogDraft.keyword as string) ?? '';

    // Calculate keyword density locally
    const wordCount = content.split(/\s+/).length;
    const keywordCount = keyword
      ? (content.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) ?? []).length
      : 0;
    const density = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;
    const densityStatus = density < 0.8 ? 'low' : density > 2.5 ? 'high' : 'optimal';

    const result = await ctx.llm.completeJSON<{
      metaTitle: string;
      metaDescription: string;
      faqQuestions: Array<{ question: string; answer: string }>;
      altTexts: string[];
      scoreCard: {
        overall: number;
        titleScore: number;
        metaScore: number;
        contentScore: number;
        keywordScore: number;
        readabilityScore: number;
        structureScore: number;
        issues: string[];
        recommendations: string[];
      };
    }>(
      `You are an SEO specialist. Optimize this blog content:

Title: ${title}
Primary Keyword: ${keyword}
Word Count: ${wordCount}
Keyword Density: ${density.toFixed(2)}%

Content preview (first 3000 chars):
${content.slice(0, 3000)}

Generate:
1. Meta title (max 60 chars, include keyword near start)
2. Meta description (max 160 chars, include keyword, add CTA)
3. 3-5 FAQ questions with answers (for FAQ schema / featured snippets)
4. 3-5 image alt-text suggestions
5. SEO score card (each category 0-100):
   - Title optimization
   - Meta description quality
   - Content depth
   - Keyword usage
   - Readability
   - Structure (headers, lists, etc.)
   - Overall score
   - Issues found
   - Recommendations

JSON: {
  "metaTitle": "<60 char max>",
  "metaDescription": "<160 char max>",
  "faqQuestions": [{"question": "", "answer": ""}],
  "altTexts": ["alt text 1"],
  "scoreCard": {
    "overall": 0, "titleScore": 0, "metaScore": 0,
    "contentScore": 0, "keywordScore": 0,
    "readabilityScore": 0, "structureScore": 0,
    "issues": ["issue1"],
    "recommendations": ["rec1"]
  }
}`,
      { type: 'object' },
      { tier: 'routine' }
    );

    // Build schema markup
    const schemaMarkup = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: result.data.metaTitle,
      description: result.data.metaDescription,
      wordCount,
      author: { '@type': 'Organization', name: ctx.brand.name },
    };

    const faqSchema = result.data.faqQuestions.length > 0 ? {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: result.data.faqQuestions.map(q => ({
        '@type': 'Question',
        name: q.question,
        acceptedAnswer: { '@type': 'Answer', text: q.answer },
      })),
    } : null;

    const seoPackage: SEOPackage = {
      metaTitle: result.data.metaTitle,
      metaDescription: result.data.metaDescription,
      schemaMarkup,
      faqSchema,
      altTexts: result.data.altTexts,
      keywordDensity: { keyword, density, status: densityStatus },
      scoreCard: result.data.scoreCard,
    };

    return {
      output: { seo_package: seoPackage },
      tokensUsed: result.meta.totalTokens,
      costUnits: result.meta.costUnits,
      modelUsed: result.meta.model,
      durationMs: Date.now() - start,
    };
  },
};
