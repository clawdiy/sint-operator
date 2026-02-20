/**
 * Telegram Notification Service
 * 
 * Sends notifications via Telegram Bot API when pipelines complete.
 * Requires: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */

import https from 'https';
import type { Logger } from '../../core/types.js';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface TelegramResult {
  ok: boolean;
  messageId?: number;
  error?: string;
}

function getConfig(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

/**
 * Send a message via Telegram Bot API.
 */
export async function sendTelegramMessage(
  text: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML',
  logger?: Logger,
): Promise<TelegramResult> {
  const config = getConfig();
  if (!config) {
    logger?.warn('Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID missing)');
    return { ok: false, error: 'Telegram not configured' };
  }

  const body = JSON.stringify({
    chat_id: config.chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${config.botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body).toString(),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.ok) {
              logger?.info('Telegram notification sent', { messageId: parsed.result?.message_id });
              resolve({ ok: true, messageId: parsed.result?.message_id });
            } else {
              logger?.error('Telegram send failed', { error: parsed.description });
              resolve({ ok: false, error: parsed.description });
            }
          } catch {
            resolve({ ok: false, error: data });
          }
        });
      },
    );
    req.on('error', (err) => resolve({ ok: false, error: err.message }));
    req.write(body);
    req.end();
  });
}

/**
 * Send pipeline completion notification.
 */
export async function notifyPipelineComplete(
  pipelineName: string,
  brandName: string,
  runId: string,
  status: 'completed' | 'failed',
  details: {
    duration?: number;
    costUnits?: number;
    tokensUsed?: number;
    outputCount?: number;
    error?: string;
    dashboardUrl?: string;
  },
  logger?: Logger,
): Promise<TelegramResult> {
  const icon = status === 'completed' ? '✅' : '❌';
  const dashUrl = details.dashboardUrl || process.env.DASHBOARD_URL || '';

  let message = `${icon} <b>Pipeline ${status}</b>\n\n`;
  message += `<b>Pipeline:</b> ${pipelineName}\n`;
  message += `<b>Brand:</b> ${brandName}\n`;
  message += `<b>Run:</b> <code>${runId}</code>\n`;

  if (status === 'completed') {
    if (details.duration) message += `<b>Duration:</b> ${(details.duration / 1000).toFixed(1)}s\n`;
    if (details.outputCount) message += `<b>Outputs:</b> ${details.outputCount} deliverables\n`;
    if (details.costUnits) message += `<b>Cost:</b> ${details.costUnits} units (~$${(details.costUnits * 0.01).toFixed(2)})\n`;
    if (details.tokensUsed) message += `<b>Tokens:</b> ${details.tokensUsed.toLocaleString()}\n`;
  } else {
    if (details.error) message += `<b>Error:</b> ${details.error.slice(0, 200)}\n`;
  }

  if (dashUrl) {
    message += `\n<a href="${dashUrl}/#results/${runId}">View Results →</a>`;
  }

  return sendTelegramMessage(message, 'HTML', logger);
}

/**
 * Check if Telegram notifications are configured.
 */
export function isTelegramConfigured(): boolean {
  return getConfig() !== null;
}
