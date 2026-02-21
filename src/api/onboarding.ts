import { Router } from 'express';
import { ZodError, z } from 'zod';
import { createBrand, listBrands, saveBrand } from '../core/brand/manager.js';
import type { AuthenticatedRequest } from '../auth/auth-middleware.js';
import { getUser } from '../auth/auth-service.js';
import { hasApiKey, storeApiKey } from '../auth/api-key-service.js';

const setupSchema = z.object({
  openaiApiKey: z.string().trim().min(1),
  brandName: z.string().trim().min(1),
  brandUrl: z.string().trim().url().optional(),
  brandTone: z.array(z.string().trim().min(1)).optional(),
});

function getUserId(req: AuthenticatedRequest): string | null {
  // When auth is disabled, use default user
  if (process.env.AUTH_ENABLED !== 'true') return 'default';
  return req.user?.userId ?? null;
}

async function validateOpenAiKey(apiKey: string): Promise<boolean> {
  const baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  const endpoint = `${baseUrl}/chat/completions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.SINT_ONBOARDING_MODEL ?? 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Reply with: ok' }],
        max_tokens: 5,
      }),
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function createOnboardingRouter(options: { brandsDir: string }): Router {
  const router = Router();

  router.get('/status', (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = getUser(userId);
      const hasUser = !!user;
      const hasKey = hasApiKey(userId);
      const hasBrand = listBrands(userId).length > 0;

      res.json({
        needsSetup: !hasKey || !hasBrand,
        hasApiKey: hasKey,
        hasBrand,
        hasUser,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  router.post('/setup', async (req, res) => {
    try {
      const userId = getUserId(req as AuthenticatedRequest);
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const payload = setupSchema.parse(req.body ?? {});
      const isValid = await validateOpenAiKey(payload.openaiApiKey);

      if (!isValid) {
        res.status(400).json({ error: 'Invalid API key — could not connect to OpenAI' });
        return;
      }

      storeApiKey(userId, payload.openaiApiKey);

      const tone = payload.brandTone && payload.brandTone.length > 0
        ? payload.brandTone
        : ['Professional'];

      const styleNote = payload.brandUrl
        ? `Clear, useful marketing copy. Website: ${payload.brandUrl}`
        : 'Clear, useful marketing copy with direct CTA language.';

      const brand = createBrand(userId, {
        name: payload.brandName,
        voice: {
          tone,
          style: styleNote,
          doNot: ['Use vague fluff', 'Make unverifiable claims', 'Overuse emojis'],
          vocabulary: ['strategy', 'campaign', 'audience', 'insight', 'conversion'],
          examples: [],
        },
        visual: {
          primaryColors: ['#0B1F3A'],
          secondaryColors: ['#F3F6FB', '#2A7FFF'],
          fonts: ['Inter', 'System UI'],
        },
        platforms: [],
        keywords: [],
        competitors: [],
      });

      saveBrand(brand, options.brandsDir);

      res.json({ success: true, brand });
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: error.issues[0]?.message ?? 'Invalid setup payload' });
        return;
      }

      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  return router;
}
