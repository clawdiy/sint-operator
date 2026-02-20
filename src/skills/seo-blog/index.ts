/**
 * SEO Blog Skill v2
 * 
 * Two-step generation:
 * 1. Outline with keyword research (routine tier)
 * 2. Full article writing (complex tier)
 */

import { buildBrandContext } from '../../core/brand/manager.js';
import type { Skill, SkillContext, SkillResult } from '../../core/types.js';

interface BlogOutput {
  title: string;
  metaTitle: string;
  metaDescription: string;
  slug: string;
  content: string;
  headers: string[];
  wordCount: number;
  readingTimeMin: number;
  keywords: { primary: string; secondary: string[]; lsi: string[] };
  schemaType: string;
  notes: string;
}

export const seoBlogSkill: Skill = {
  id: 'seo-blog',
  name: 'SEO Blog Generator',
  description: 'Generate a full SEO-optimized blog article with metadata, keyword targeting, and schema recommendations.',
  version: '2.0.0',
  costUnits: 20,
  inputs: [
    { name: 'topic', type: 'string', required: true, description: 'Blog topic or title idea' },
    { name: 'keywords', type: 'array', required: false, description: 'Target keywords', default: [] },
    { name: 'word_count', type: 'number', required: false, description: 'Target word count', default: 1500 },
    { name: 'style', type: 'string', required: false, description: 'Article style', default: 'informational' },
  ],
  outputs: [
    { name: 'article', type: 'object', description: 'Complete blog article with SEO metadata' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const topic = ctx.inputs.topic as string;
    const keywords = (ctx.inputs.keywords as string[]) ?? [];
    const wordCount = (ctx.inputs.word_count as number) ?? 1500;
    const style = (ctx.inputs.style as string) ?? 'informational';
    let totalTokens = 0;
    let totalCost = 0;
    let lastModel = '';

    const brandContext = buildBrandContext(ctx.brand);

    // Step 1: Research & outline (routine tier — cost efficient)
    const outlineResult = await ctx.llm.completeJSON<{
      title: string;
      metaTitle: string;
      metaDescription: string;
      slug: string;
      keywords: { primary: string; secondary: string[]; lsi: string[] };
      headers: string[];
      schemaType: string;
    }>(`You are an expert SEO content strategist.

${brandContext}

Create a detailed blog outline:
- Topic: ${topic}
- Target keywords: ${keywords.join(', ') || 'derive from topic'}
- Target word count: ${wordCount}
- Style: ${style}
- Brand keywords: ${ctx.brand.keywords.join(', ')}

Respond with JSON:
{
  "title": "<SEO title with primary keyword>",
  "metaTitle": "<60 char max>",
  "metaDescription": "<155 char max with CTA>",
  "slug": "<url-slug>",
  "keywords": { "primary": "", "secondary": [""], "lsi": [""] },
  "headers": ["H2: ...", "H3: ..."],
  "schemaType": "Article|HowTo|FAQ|BlogPosting"
}`, { type: 'object' }, { tier: 'routine' });

    totalTokens += outlineResult.meta.totalTokens;
    totalCost += outlineResult.meta.costUnits;
    const outline = outlineResult.data;

    // Step 2: Write full article (complex tier — quality matters)
    const writeResult = await ctx.llm.complete(
      `You are a world-class blog writer.

${brandContext}

Write a complete blog article:
- Title: ${outline.title}
- Headers: ${outline.headers.join(' → ')}
- Primary keyword: ${outline.keywords.primary} (use 3-5 times naturally)
- Secondary: ${outline.keywords.secondary.join(', ')}
- LSI terms: ${outline.keywords.lsi.join(', ')}
- Target: ${wordCount} words, ${style} style

Requirements:
1. Markdown format with proper headers
2. Engaging intro (no "In today's..." cliches)
3. Bullet points and lists where appropriate
4. Strong conclusion with CTA
5. Brand voice throughout
6. Genuinely useful — not AI fluff
7. [internal link] and [external link] placeholders

Write the FULL article. Every section complete.`,
      { tier: 'complex', maxTokens: 8192, temperature: 0.7 }
    );

    totalTokens += writeResult.meta.totalTokens;
    totalCost += writeResult.meta.costUnits;
    lastModel = writeResult.meta.model;

    const actualWordCount = writeResult.text.split(/\s+/).length;

    const article: BlogOutput = {
      ...outline,
      content: writeResult.text,
      wordCount: actualWordCount,
      readingTimeMin: Math.ceil(actualWordCount / 238),
      notes: `Generated ${actualWordCount} words. Outline: ${outlineResult.meta.model}, Article: ${writeResult.meta.model}.`,
    };

    await ctx.memory.store('blog', `blog-${Date.now()}`, `${topic}: ${outline.title}`, {
      keywords: outline.keywords,
      wordCount: actualWordCount,
    });

    return {
      output: { article },
      tokensUsed: totalTokens,
      costUnits: totalCost,
      modelUsed: lastModel,
      durationMs: Date.now() - start,
    };
  },
};
