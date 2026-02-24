/**
 * Image Generator Skill
 * 
 * Wraps DALL-E 3 (OpenAI) for pipeline image generation:
 * - Infographics, ad creatives, logos, hero images, mockups
 * - Supports multiple images per call
 * - Returns URLs + revised prompts
 */

import type { Skill, SkillContext, SkillResult } from '../../core/types.js';

export const imageGeneratorSkill: Skill = {
  id: 'image-generator',
  name: 'Image Generator',
  description: 'Generate images using AI (DALL-E 3). Used by pipelines for infographics, ad creatives, logos, hero images, mockups, and color palettes.',
  version: '1.0.0',
  costUnits: 25,
  inputs: [
    { name: 'prompt', type: 'string', required: true, description: 'Image generation prompt' },
    { name: 'count', type: 'number', required: false, description: 'Number of images to generate (default 1)' },
    { name: 'size', type: 'string', required: false, description: 'Image size: 1024x1024, 1792x1024, 1024x1792' },
    { name: 'style', type: 'string', required: false, description: 'Style hint: vivid or natural' },
    { name: 'quality', type: 'string', required: false, description: 'Quality: standard or hd' },
  ],
  outputs: [
    { name: 'images', type: 'object', description: 'Array of generated image results with url and revisedPrompt' },
    { name: 'count', type: 'number', description: 'Number of images generated' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const prompt = (ctx.inputs.prompt as string) || (ctx.inputs.content as string) || '';
    const count = (ctx.inputs.count as number) || 1;
    const size = (ctx.inputs.size as string) || '1024x1024';
    const style = (ctx.inputs.style as string) || 'vivid';
    const quality = (ctx.inputs.quality as string) || 'hd';

    if (!prompt) {
      return {
        output: { images: [], count: 0, error: 'No prompt provided' },
        tokensUsed: 0,
        costUnits: 0,
        modelUsed: 'dall-e-3',
        durationMs: Date.now() - start,
      };
    }

    ctx.logger.info(`Generating ${count} image(s) with DALL-E 3: ${prompt.substring(0, 100)}...`);

    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const results: Array<{ url?: string; revisedPrompt?: string; error?: string }> = [];

    for (let i = 0; i < Math.min(count, 10); i++) {
      try {
        const response = await client.images.generate({
          model: 'dall-e-3',
          prompt: typeof prompt === 'string' ? prompt : JSON.stringify(prompt),
          n: 1,
          size: size as '1024x1024' | '1792x1024' | '1024x1792',
          quality: quality as 'standard' | 'hd',
          style: style as 'vivid' | 'natural',
        });
        results.push({
          url: response.data[0]?.url,
          revisedPrompt: response.data[0]?.revised_prompt,
        });
        ctx.logger.info(`Image ${i + 1}/${count} generated successfully`);
      } catch (err: any) {
        ctx.logger.error(`Image ${i + 1}/${count} failed: ${err.message}`);
        results.push({ error: err.message });
      }
    }

    return {
      output: { images: results, count: results.length },
      tokensUsed: count * 1000,
      costUnits: count * 25,
      modelUsed: 'dall-e-3',
      durationMs: Date.now() - start,
    };
  },
};
