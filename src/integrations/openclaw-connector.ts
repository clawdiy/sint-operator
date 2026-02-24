/**
 * OpenClaw Connector
 * 
 * Webhook receiver for OpenClaw agents to trigger SINT pipelines.
 * POST /api/webhooks/openclaw — natural language commands → pipeline execution → results
 */

import { Router, type Request, type Response } from 'express';
import type { SkillContext } from '../core/types.js';

export interface OpenClawCommand {
  message: string;
  url?: string;
  metadata?: Record<string, unknown>;
  callbackUrl?: string;
}

export interface OpenClawResponse {
  success: boolean;
  message: string;
  data?: unknown;
  error?: string;
}

interface IntentMatch {
  pipeline: string;
  inputs: Record<string, unknown>;
  confidence: number;
}

const INTENT_PATTERNS: Array<{ pattern: RegExp; pipeline: string; extractInputs: (match: RegExpMatchArray, cmd: OpenClawCommand) => Record<string, unknown> }> = [
  {
    pattern: /repurpose|shred|turn.*into.*posts|content.*repurpose/i,
    pipeline: 'content-repurpose',
    extractInputs: (_m, cmd) => ({ source_url: cmd.url, raw_text: cmd.message }),
  },
  {
    pattern: /linkedin.*post|write.*linkedin|post.*for.*linkedin/i,
    pipeline: 'linkedin-writer',
    extractInputs: (_m, cmd) => ({ topic: cmd.message, source_url: cmd.url }),
  },
  {
    pattern: /generate.*image|create.*image|make.*image|image.*gen/i,
    pipeline: 'image-generate',
    extractInputs: (_m, cmd) => ({ prompt: cmd.message }),
  },
  {
    pattern: /generate.*video|create.*video|video.*from/i,
    pipeline: 'video-generate',
    extractInputs: (_m, cmd) => ({ prompt: cmd.message, image_url: cmd.url }),
  },
  {
    pattern: /seo.*blog|write.*blog|blog.*post/i,
    pipeline: 'seo-blog',
    extractInputs: (_m, cmd) => ({ topic: cmd.message }),
  },
  {
    pattern: /newsletter/i,
    pipeline: 'newsletter',
    extractInputs: (_m, cmd) => ({ topic: cmd.message }),
  },
  {
    pattern: /analyz|research|competitor/i,
    pipeline: 'content-analyzer',
    extractInputs: (_m, cmd) => ({ source_url: cmd.url, query: cmd.message }),
  },
];

function matchIntent(cmd: OpenClawCommand): IntentMatch | null {
  for (const { pattern, pipeline, extractInputs } of INTENT_PATTERNS) {
    const match = cmd.message.match(pattern);
    if (match) {
      return {
        pipeline,
        inputs: extractInputs(match, cmd),
        confidence: 0.8,
      };
    }
  }
  return null;
}

export interface OpenClawConnectorConfig {
  secret?: string;
  onPipelineRun?: (pipeline: string, inputs: Record<string, unknown>) => Promise<unknown>;
}

export function createOpenClawRoutes(config: OpenClawConnectorConfig): Router {
  const router = Router();

  // Auth middleware
  router.use((req: Request, res: Response, next) => {
    if (config.secret) {
      const provided = req.headers['x-openclaw-secret'] ?? req.headers['authorization']?.replace('Bearer ', '');
      if (provided !== config.secret) {
        res.status(401).json({ success: false, error: 'Unauthorized' } satisfies OpenClawResponse);
        return;
      }
    }
    next();
  });

  // Main webhook endpoint
  router.post('/openclaw', async (req: Request, res: Response) => {
    try {
      const cmd = req.body as OpenClawCommand;
      if (!cmd.message) {
        res.status(400).json({ success: false, error: 'Missing message field' } satisfies OpenClawResponse);
        return;
      }

      const intent = matchIntent(cmd);
      if (!intent) {
        res.json({
          success: false,
          message: 'Could not determine intent from command',
          error: `No matching pipeline for: "${cmd.message.slice(0, 100)}"`,
        } satisfies OpenClawResponse);
        return;
      }

      // Execute pipeline if handler provided
      let result: unknown = null;
      if (config.onPipelineRun) {
        result = await config.onPipelineRun(intent.pipeline, intent.inputs);
      }

      res.json({
        success: true,
        message: `Executed pipeline: ${intent.pipeline}`,
        data: {
          pipeline: intent.pipeline,
          confidence: intent.confidence,
          result,
        },
      } satisfies OpenClawResponse);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ success: false, error: message } satisfies OpenClawResponse);
    }
  });

  // Health check
  router.get('/openclaw/status', (_req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'OpenClaw connector active',
      data: {
        pipelines: INTENT_PATTERNS.map((p) => p.pipeline),
      },
    });
  });

  return router;
}
