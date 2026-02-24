/**
 * Schema Generator Skill
 * 
 * Generates JSON-LD structured data for SEO:
 * - Article schema
 * - FAQPage schema
 * - HowTo schema
 * - BreadcrumbList schema
 */

import type { Skill, SkillContext, SkillResult } from '../../core/types.js';

export const schemaGeneratorSkill: Skill = {
  id: 'schema-generator',
  name: 'Schema Generator',
  description: 'Generate JSON-LD structured data (Article, FAQPage, HowTo) for SEO blog posts and web pages.',
  version: '1.0.0',
  costUnits: 5,
  inputs: [
    { name: 'content', type: 'object', required: true, description: 'Blog content with title, body, metadata' },
    { name: 'schema_types', type: 'array', required: false, description: 'Schema types to generate: article, faq, howto' },
    { name: 'site_url', type: 'string', required: false, description: 'Base URL of the website' },
    { name: 'author', type: 'string', required: false, description: 'Author name' },
  ],
  outputs: [
    { name: 'schemas', type: 'object', description: 'Generated JSON-LD schemas' },
    { name: 'script_tags', type: 'string', description: 'Ready-to-embed script tags' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const content = ctx.inputs.content as Record<string, any> || {};
    const schemaTypes = (ctx.inputs.schema_types as string[]) || ['article'];
    const siteUrl = (ctx.inputs.site_url as string) || 'https://example.com';
    const author = (ctx.inputs.author as string) || ctx.brand?.name || 'Author';

    const title = content.meta_title || content.title || content.topic || '';
    const description = content.meta_description || content.description || '';
    const body = content.article_body || content.body || content.article || '';
    const keywords = content.keywords || [];
    const headings = content.heading_structure || content.headings || [];

    ctx.logger.info(`Generating JSON-LD schemas: ${schemaTypes.join(', ')}`);

    const schemas: Record<string, any> = {};
    const now = new Date().toISOString();

    // Article Schema
    if (schemaTypes.includes('article')) {
      schemas.article = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        description,
        author: { '@type': 'Person', name: author },
        publisher: {
          '@type': 'Organization',
          name: ctx.brand?.name || author,
        },
        datePublished: now,
        dateModified: now,
        mainEntityOfPage: { '@type': 'WebPage', '@id': siteUrl },
        keywords: Array.isArray(keywords) ? keywords.join(', ') : keywords,
        wordCount: typeof body === 'string' ? body.split(/\s+/).length : 0,
      };
    }

    // FAQ Schema — extract Q&A patterns from content
    if (schemaTypes.includes('faq')) {
      const faqItems = extractFAQs(typeof body === 'string' ? body : JSON.stringify(body));
      if (faqItems.length > 0) {
        schemas.faq = {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqItems.map(({ q, a }) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: a },
          })),
        };
      }
    }

    // HowTo Schema — extract steps from content
    if (schemaTypes.includes('howto')) {
      const steps = extractSteps(typeof body === 'string' ? body : JSON.stringify(body));
      if (steps.length > 0) {
        schemas.howto = {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: title,
          description,
          step: steps.map((text, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            text,
          })),
        };
      }
    }

    // Generate script tags
    const scriptTags = Object.values(schemas)
      .map(s => `<script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n</script>`)
      .join('\n\n');

    return {
      output: { schemas, script_tags: scriptTags, schema_count: Object.keys(schemas).length },
      tokensUsed: 100,
      costUnits: 5,
      modelUsed: 'none',
      durationMs: Date.now() - start,
    };
  },
};

/** Extract FAQ-like patterns (## Q: / **Q:** / lines ending with ?) */
function extractFAQs(text: string): Array<{ q: string; a: string }> {
  const faqs: Array<{ q: string; a: string }> = [];
  // Match heading-style questions followed by content
  const pattern = /(?:#{1,3}\s*(?:Q:|FAQ:?)?\s*(.+?\?)\s*\n)([\s\S]*?)(?=(?:#{1,3}|\Z))/gi;
  let match;
  while ((match = pattern.exec(text)) !== null && faqs.length < 10) {
    const q = match[1].trim();
    const a = match[2].trim().substring(0, 500);
    if (q && a) faqs.push({ q, a });
  }
  return faqs;
}

/** Extract numbered steps from content */
function extractSteps(text: string): string[] {
  const steps: string[] = [];
  const pattern = /(?:^|\n)\s*(?:step\s*)?(\d+)[.):\s]+(.+)/gi;
  let match;
  while ((match = pattern.exec(text)) !== null && steps.length < 20) {
    steps.push(match[2].trim());
  }
  return steps;
}
