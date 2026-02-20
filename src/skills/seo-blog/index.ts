/**
 * SEO Blog Skill
 * 
 * Generates a full SEO-optimized blog post with:
 * - Keyword research integration
 * - Structured headers (H1-H3)
 * - Meta description & title
 * - Internal/external link suggestions
 * - Schema markup recommendations
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
  description: 'Generate a full SEO-optimized blog article',
  version: '1.0.0',
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

    const brandContext = buildBrandContext(ctx.brand);

    // Step 1: Research & outline
    const outlinePrompt = `You are an expert SEO content strategist.

${brandContext}

Create a detailed blog outline for the following:
- Topic: ${topic}
- Target keywords: ${keywords.join(', ') || 'derive from topic'}
- Target word count: ${wordCount}
- Style: ${style}
- Brand keywords to weave in: ${ctx.brand.keywords.join(', ')}

Respond with JSON:
{
  "title": "<SEO-optimized title with primary keyword>",
  "metaTitle": "<60 char max meta title>",
  "metaDescription": "<155 char max meta description with CTA>",
  "slug": "<url-friendly-slug>",
  "keywords": {
    "primary": "<main keyword>",
    "secondary": ["<2-3 secondary keywords>"],
    "lsi": ["<5-8 LSI/related terms>"]
  },
  "headers": ["H2: ...", "H3: ...", "H2: ...", "H3: ..."],
  "schemaType": "Article|HowTo|FAQ|BlogPosting"
}`;

    const outline = await ctx.llm.completeJSON<{
      title: string;
      metaTitle: string;
      metaDescription: string;
      slug: string;
      keywords: { primary: string; secondary: string[]; lsi: string[] };
      headers: string[];
      schemaType: string;
    }>(outlinePrompt, { type: 'object' });

    // Step 2: Write full article
    const writePrompt = `You are a world-class blog writer specializing in SEO content.

${brandContext}

Write a complete blog article based on this outline:
- Title: ${outline.title}
- Headers: ${outline.headers.join(' → ')}
- Primary keyword: ${outline.keywords.primary} (use 3-5 times naturally)
- Secondary keywords: ${outline.keywords.secondary.join(', ')}
- LSI terms to include: ${outline.keywords.lsi.join(', ')}
- Target word count: ${wordCount}
- Style: ${style}

Requirements:
1. Write in Markdown format
2. Start with an engaging intro (no "In today's..." openings)
3. Use the header structure provided
4. Include bullet points and numbered lists where appropriate
5. End with a strong conclusion and CTA
6. Maintain brand voice throughout
7. Make it genuinely useful — not AI-sounding fluff
8. Include [suggested internal link] and [suggested external link] placeholders where relevant

Write the FULL article now. No shortcuts, no summaries. Every section complete.`;

    const content = await ctx.llm.complete(writePrompt, {
      maxTokens: 8192,
      temperature: 0.7,
    });

    const actualWordCount = content.split(/\s+/).length;

    const result: BlogOutput = {
      ...outline,
      content,
      wordCount: actualWordCount,
      readingTimeMin: Math.ceil(actualWordCount / 238),
      notes: `Generated ${actualWordCount} words. Reading time: ~${Math.ceil(actualWordCount / 238)} min.`,
    };

    // Store in memory
    await ctx.memory.store('blog', `blog-${Date.now()}`, `${topic}: ${outline.title}`, {
      keywords: outline.keywords,
      wordCount: actualWordCount,
    });

    return {
      output: { article: result },
      tokensUsed: 0,
      durationMs: Date.now() - start,
    };
  },
};
