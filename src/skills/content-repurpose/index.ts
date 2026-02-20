/**
 * Content Repurpose Skill
 * 
 * Takes any content (text, article, transcript) and repurposes it
 * into multiple platform-ready formats. The core value prop:
 * one input → many outputs.
 */

import { buildBrandContext } from '../../core/brand/manager.js';
import type { Skill, SkillContext, SkillResult, Platform, ContentFormat } from '../../core/types.js';

interface RepurposeOutput {
  deliverables: Array<{
    platform: Platform;
    format: ContentFormat;
    content: string;
    hashtags?: string[];
    notes?: string;
  }>;
  summary: string;
}

const PLATFORM_SPECS: Record<string, { maxLength: number; format: string; notes: string }> = {
  twitter: {
    maxLength: 280,
    format: 'thread',
    notes: 'Create a 3-5 tweet thread. First tweet must hook. Use line breaks. No hashtags in first tweet.',
  },
  linkedin: {
    maxLength: 3000,
    format: 'text',
    notes: 'Professional tone. Open with a bold statement or question. Use line breaks every 1-2 sentences. End with a question or CTA. 3-5 hashtags at the end.',
  },
  instagram: {
    maxLength: 2200,
    format: 'caption',
    notes: 'Engaging caption. Open with hook. Include CTA. 20-30 hashtags in a comment block (separated by dots from main caption).',
  },
  tiktok: {
    maxLength: 300,
    format: 'caption',
    notes: 'Short, punchy caption. Use trending language. 3-5 hashtags including at least one trending tag.',
  },
  facebook: {
    maxLength: 5000,
    format: 'text',
    notes: 'Conversational tone. Medium length. Include question for engagement. 1-3 hashtags max.',
  },
  blog: {
    maxLength: 50000,
    format: 'article',
    notes: 'Full article with H2/H3 headers, intro, body, conclusion. SEO-optimized. 1000-2000 words.',
  },
  email: {
    maxLength: 10000,
    format: 'newsletter',
    notes: 'Newsletter format with subject line, preview text, body sections, and CTA.',
  },
  telegram: {
    maxLength: 4096,
    format: 'text',
    notes: 'Clean formatting. Use bold and italic markdown. Direct and informative.',
  },
  threads: {
    maxLength: 500,
    format: 'text',
    notes: 'Casual, conversational. Similar to Twitter but slightly longer. Minimal hashtags.',
  },
};

export const contentRepurposeSkill: Skill = {
  id: 'content-repurpose',
  name: 'Content Repurpose',
  description: 'Repurpose any content into platform-specific deliverables',
  version: '1.0.0',
  inputs: [
    { name: 'text', type: 'string', required: true, description: 'Source content to repurpose' },
    { name: 'target_platforms', type: 'array', required: true, description: 'Platforms to generate for' },
    { name: 'focus', type: 'string', required: false, description: 'Optional angle/focus for repurposing', default: '' },
  ],
  outputs: [
    { name: 'deliverables', type: 'array', description: 'Platform-specific content pieces' },
    { name: 'summary', type: 'string', description: 'Summary of generated content' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const text = ctx.inputs.text as string;
    const platforms = ctx.inputs.target_platforms as string[];
    const focus = (ctx.inputs.focus as string) ?? '';

    const brandContext = buildBrandContext(ctx.brand);

    // Build platform specs for requested platforms
    const platformInstructions = platforms
      .map(p => {
        const spec = PLATFORM_SPECS[p];
        if (!spec) return null;
        return `\n### ${p.toUpperCase()}\n- Max length: ${spec.maxLength} chars\n- Format: ${spec.format}\n- ${spec.notes}`;
      })
      .filter(Boolean)
      .join('\n');

    const prompt = `You are a world-class content strategist. Repurpose the following source content into platform-specific deliverables.

${brandContext}

## Source Content:
${text.slice(0, 15000)}

${focus ? `## Focus Angle: ${focus}` : ''}

## Target Platforms and Specifications:
${platformInstructions}

## Instructions:
1. Analyze the source content for key messages, insights, and hooks
2. For EACH platform, create content that:
   - Follows that platform's native content patterns
   - Respects the character/format limits
   - Maintains brand voice throughout
   - Maximizes engagement for that platform's algorithm
3. Each piece should be COMPLETE and READY TO POST — no placeholders

Respond with a JSON object with this structure:
{
  "deliverables": [
    {
      "platform": "<platform>",
      "format": "<format>",
      "content": "<the full ready-to-post content>",
      "hashtags": ["tag1", "tag2"],
      "notes": "<any posting tips for this piece>"
    }
  ],
  "summary": "<brief summary of what was generated>"
}`;

    const result = await ctx.llm.completeJSON<RepurposeOutput>(prompt, {
      type: 'object',
      properties: {
        deliverables: { type: 'array' },
        summary: { type: 'string' },
      },
    });

    // Store in memory for brand learning
    await ctx.memory.store('repurpose', `run-${Date.now()}`, text.slice(0, 500), {
      platforms,
      outputCount: result.deliverables.length,
    });

    return {
      output: result,
      tokensUsed: 0, // TODO: track from LLM response
      durationMs: Date.now() - start,
    };
  },
};
