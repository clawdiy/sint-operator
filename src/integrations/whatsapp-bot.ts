/**
 * WhatsApp Business Cloud API Integration
 *
 * Webhook endpoint for incoming messages.
 * Send messages via WhatsApp Business API.
 * Requires: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN
 */

import https from 'https';
import type { Request, Response } from 'express';
import type { Orchestrator } from '../orchestrator/index.js';
import {
  listApprovals,
  approveItem,
  rejectItem,
} from '../services/approval/index.js';

let orchestratorRef: Orchestrator | null = null;

interface WhatsAppConfig {
  token: string;
  phoneNumberId: string;
  verifyToken: string;
}

function getConfig(): WhatsAppConfig | null {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'sint-verify';
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId, verifyToken };
}

export function initWhatsAppBot(orchestrator: Orchestrator): void {
  orchestratorRef = orchestrator;
  const config = getConfig();
  if (!config) {
    console.warn('[WhatsApp] WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set — bot disabled');
  } else {
    console.log('[WhatsApp] Bot configured');
  }
}

/**
 * Send a text message via WhatsApp Business API.
 */
export async function sendWhatsAppMessage(to: string, text: string): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;

  const body = JSON.stringify({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'graph.facebook.com',
      path: `/v18.0/${config.phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(!!parsed.messages?.length);
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.write(body);
    req.end();
  });
}

/**
 * Send a template message (for approvals).
 */
export async function sendWhatsAppTemplate(to: string, templateName: string, params: string[]): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;

  const body = JSON.stringify({
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en_US' },
      components: params.length > 0 ? [{
        type: 'body',
        parameters: params.map(p => ({ type: 'text', text: p })),
      }] : undefined,
    },
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'graph.facebook.com',
      path: `/v18.0/${config.phoneNumberId}/messages`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(res.statusCode === 200));
    });
    req.on('error', () => resolve(false));
    req.write(body);
    req.end();
  });
}

/**
 * Handle incoming text command from WhatsApp.
 */
async function handleTextMessage(from: string, text: string): Promise<void> {
  const cmd = text.trim().toLowerCase();

  if (cmd === '/start' || cmd === 'hi' || cmd === 'hello') {
    await sendWhatsAppMessage(from,
      '🎯 SINT Marketing Operator\n\n' +
      'Commands:\n' +
      '/pipelines — List pipelines\n' +
      '/brands — List brands\n' +
      '/status — Recent runs\n' +
      '/approve — Pending approvals\n' +
      '/approve <id> — Approve item\n' +
      '/reject <id> — Reject item'
    );
    return;
  }

  if (cmd === '/pipelines') {
    const pipelines = orchestratorRef?.listPipelines() || [];
    if (pipelines.length === 0) {
      await sendWhatsAppMessage(from, '📭 No pipelines configured.');
      return;
    }
    const list = pipelines.map((p: any, i: number) => `${i + 1}. ${p.name || p.id} — ${p.description || 'No description'}`).join('\n');
    await sendWhatsAppMessage(from, `⚡ Pipelines:\n\n${list}`);
    return;
  }

  if (cmd === '/brands') {
    const brands = orchestratorRef?.listBrands() || [];
    if (brands.length === 0) {
      await sendWhatsAppMessage(from, '📭 No brands configured.');
      return;
    }
    const list = brands.map((b: any, i: number) => `${i + 1}. ${b.name} (${b.id})`).join('\n');
    await sendWhatsAppMessage(from, `🎨 Brands:\n\n${list}`);
    return;
  }

  if (cmd === '/status') {
    const runs = orchestratorRef?.listRuns().slice(0, 5) || [];
    if (runs.length === 0) {
      await sendWhatsAppMessage(from, '📭 No recent runs.');
      return;
    }
    const list = runs.map((r: any) => {
      const icon = r.status === 'completed' ? '✅' : r.status === 'failed' ? '❌' : '🔄';
      return `${icon} ${r.pipelineId} — ${r.status}`;
    }).join('\n');
    await sendWhatsAppMessage(from, `📊 Recent Runs:\n\n${list}`);
    return;
  }

  if (cmd === '/approve') {
    const pending = listApprovals({ status: 'pending_review', limit: 5 });
    if (pending.length === 0) {
      await sendWhatsAppMessage(from, '✨ No pending approvals!');
      return;
    }
    for (const item of pending) {
      await sendWhatsAppMessage(from,
        `📋 Approval: ${item.id}\n` +
        `Platform: ${item.platform || 'N/A'}\n` +
        `Type: ${item.contentType}\n\n` +
        `${item.contentPreview.slice(0, 300)}\n\n` +
        `Reply: /approve ${item.id} or /reject ${item.id}`
      );
    }
    return;
  }

  if (cmd.startsWith('/approve ')) {
    const id = cmd.split(' ')[1];
    const success = approveItem(id);
    await sendWhatsAppMessage(from, success ? `✅ Approved: ${id}` : `❌ Not found: ${id}`);
    return;
  }

  if (cmd.startsWith('/reject ')) {
    const id = cmd.split(' ')[1];
    const success = rejectItem(id, 'Rejected via WhatsApp');
    await sendWhatsAppMessage(from, success ? `❌ Rejected: ${id}` : `❌ Not found: ${id}`);
    return;
  }

  await sendWhatsAppMessage(from, 'Unknown command. Send "hi" for help.');
}

/**
 * WhatsApp webhook handler — verification (GET) and messages (POST).
 */
export function whatsappWebhook(req: Request, res: Response): void {
  const config = getConfig();

  // GET = webhook verification
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === (config?.verifyToken || 'sint-verify')) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
    return;
  }

  // POST = incoming message
  if (!config) {
    res.sendStatus(200); // Always 200 to prevent retries
    return;
  }

  try {
    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (value?.messages?.[0]) {
      const message = value.messages[0];
      const from = message.from;

      if (message.type === 'text' && message.text?.body) {
        void handleTextMessage(from, message.text.body);
      }
      // File uploads
      if (['image', 'video', 'document'].includes(message.type)) {
        void sendWhatsAppMessage(from, '📁 File received! Asset ingestion via WhatsApp coming soon.');
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[WhatsApp] Webhook error:', err);
    res.sendStatus(200);
  }
}
