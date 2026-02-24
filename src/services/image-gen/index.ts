/**
 * Image Generation Service
 * 
 * Multi-provider image generation: OpenAI (DALL-E 3, gpt-image-1), Stability AI
 * Factory pattern for provider selection.
 */

import OpenAI from 'openai';

export interface ImageGenRequest {
  prompt: string;
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  style?: 'natural' | 'vivid';
  model?: 'dall-e-3' | 'gpt-image-1' | 'stability';
  n?: number;
}

export interface ImageGenResult {
  url?: string;
  base64?: string;
  revisedPrompt?: string;
}

export interface ImageGenProvider {
  generate(req: ImageGenRequest): Promise<ImageGenResult[]>;
}

// --- OpenAI Provider (DALL-E 3 / gpt-image-1) ---

class OpenAIImageGen implements ImageGenProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generate(req: ImageGenRequest): Promise<ImageGenResult[]> {
    const model = req.model === 'gpt-image-1' ? 'gpt-image-1' : 'dall-e-3';
    const response = await this.client.images.generate({
      model,
      prompt: req.prompt,
      n: req.n ?? 1,
      size: req.size ?? '1024x1024',
      ...(model === 'dall-e-3' ? { style: req.style ?? 'vivid' } : {}),
      response_format: 'url',
    });

    return (response.data ?? []).map((img) => ({
      url: img.url,
      base64: img.b64_json ?? undefined,
      revisedPrompt: img.revised_prompt ?? undefined,
    }));
  }
}

// --- Stability AI Provider ---

class StabilityImageGen implements ImageGenProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(req: ImageGenRequest): Promise<ImageGenResult[]> {
    const form = new FormData();
    form.append('prompt', req.prompt);
    form.append('output_format', 'png');
    // Map sizes to aspect ratio
    if (req.size === '1792x1024') form.append('aspect_ratio', '16:9');
    else if (req.size === '1024x1792') form.append('aspect_ratio', '9:16');
    else form.append('aspect_ratio', '1:1');

    const res = await fetch('https://api.stability.ai/v2beta/stable-image/generate/sd3', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Stability AI error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as { image?: string; images?: Array<{ base64: string }> };
    
    if (data.image) {
      return [{ base64: data.image }];
    }
    if (data.images) {
      return data.images.map((img) => ({ base64: img.base64 }));
    }
    return [{ base64: (data as any).artifacts?.[0]?.base64 }];
  }
}

// --- Factory ---

export type ImageGenProviderType = 'openai' | 'stability';

export function createImageGen(provider: ImageGenProviderType, apiKey: string): ImageGenProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIImageGen(apiKey);
    case 'stability':
      return new StabilityImageGen(apiKey);
    default:
      throw new Error(`Unknown image gen provider: ${provider}`);
  }
}

/**
 * Convenience: generate image using env-configured provider
 */
export async function generateImage(req: ImageGenRequest): Promise<ImageGenResult[]> {
  if (req.model === 'stability') {
    const key = process.env.STABILITY_API_KEY;
    if (!key) throw new Error('STABILITY_API_KEY not configured');
    return createImageGen('stability', key).generate(req);
  }
  
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');
  return createImageGen('openai', key).generate(req);
}
