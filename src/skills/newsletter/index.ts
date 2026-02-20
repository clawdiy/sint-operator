/**
 * Newsletter Generator Skill
 * 
 * Generates email newsletter from recent content, brand updates, or topics.
 * Outputs: subject line, preview text, sections with headers, CTA.
 * Uses complex tier for quality long-form writing.
 */

import { buildBrandContext } from '../../core/brand/manager.js';
import type { Skill, SkillContext, SkillResult } from '../../core/types.js';

interface NewsletterOutput {
  subject: string;
  previewText: string;
  sections: Array<{
    heading: string;
    body: string;
    cta?: { text: string; url: string };
  }>;
  closingCta: { text: string; url: string };
  plainText: string;
  wordCount: number;
}

export const newsletterSkill: Skill = {
  id: 'newsletter',
  name: 'Newsletter Generator',
  description: 'Generate a complete email newsletter with subject line, sections, CTAs, and plain-text fallback.',
  version: '1.0.0',
  costUnits: 15,
  inputs: [
    { name: 'topic', type: 'string', required: true, description: 'Newsletter topic or theme' },
    { name: 'key_points', type: 'array', required: false, description: 'Key points to cover', default: [] },
    { name: 'audience', type: 'string', required: false, description: 'Target audience description', default: '' },
    { name: 'tone_override', type: 'string', required: false, description: 'Override brand tone for this newsletter', default: '' },
    { name: 'cta_url', type: 'string', required: false, description: 'Primary CTA link', default: '' },
    { name: 'section_count', type: 'number', required: false, description: 'Number of sections', default: 3 },
  ],
  outputs: [
    { name: 'newsletter', type: 'object', description: 'Complete newsletter with all sections' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const topic = ctx.inputs.topic as string;
    const keyPoints = (ctx.inputs.key_points as string[]) ?? [];
    const audience = (ctx.inputs.audience as string) ?? '';
    const toneOverride = (ctx.inputs.tone_override as string) ?? '';
    const ctaUrl = (ctx.inputs.cta_url as string) ?? '';
    const sectionCount = (ctx.inputs.section_count as number) ?? 3;

    const brandContext = buildBrandContext(ctx.brand);

    const result = await ctx.llm.completeJSON<NewsletterOutput>(
      `You write newsletters that people actually open and read. Not marketing spam — useful content with personality.

${brandContext}

${toneOverride ? `## Tone Override: ${toneOverride}` : ''}

## Newsletter Brief
- Topic: ${topic}
- Sections: ${sectionCount}
${keyPoints.length > 0 ? `- Must cover: ${keyPoints.join(', ')}` : ''}
${audience ? `- Audience: ${audience}` : ''}
${ctaUrl ? `- Primary CTA URL: ${ctaUrl}` : ''}

## Structure Rules
1. **Subject line**: Max 50 chars. Must create curiosity or promise specific value. No clickbait. No ALL CAPS. No 🔥 emoji.
2. **Preview text**: Max 90 chars. Complements the subject — adds context, doesn't repeat it.
3. **Sections** (${sectionCount}): Each has a heading (max 8 words) and body (150-300 words). Lead with the insight, not setup.
4. **Section CTAs**: Optional per section. Only if there's a genuine link worth clicking.
5. **Closing CTA**: One clear action. Tell them exactly what they get by clicking.
6. **Plain text**: Full newsletter in plain text (no HTML). This is what some email clients show.

## Writing Rules
- First section must hook immediately. If someone only reads one section, this is it.
- Each section should be independently valuable — readers skim.
- No "In this newsletter, we'll cover..." — just start.
- Use short paragraphs (2-3 sentences max).
- One idea per section. Go deep, not wide.
- End sections with a forward-looking statement or question, not a summary.

Respond ONLY with valid JSON:
{
  "subject": "<50 chars>",
  "previewText": "<90 chars>",
  "sections": [{"heading": "", "body": "", "cta": {"text": "", "url": ""}}],
  "closingCta": {"text": "", "url": ""},
  "plainText": "<full plain-text version>",
  "wordCount": 0
}`,
      { type: 'object' },
      { tier: 'complex', maxTokens: 4096, temperature: 0.7 },
    );

    return {
      output: { newsletter: result.data },
      tokensUsed: result.meta.totalTokens,
      costUnits: result.meta.costUnits,
      modelUsed: result.meta.model,
      durationMs: Date.now() - start,
    };
  },
};
