/**
 * Telegram Bot Integration
 *
 * Full interactive bot for SINT — lets users manage pipelines,
 * brands, runs, and approvals via Telegram.
 *
 * Uses node-telegram-bot-api for long polling.
 * Gracefully handles missing TELEGRAM_BOT_TOKEN.
 */

import TelegramBot from 'node-telegram-bot-api';
import { resolve, join } from 'path';
import { mkdirSync, createWriteStream } from 'fs';
import https from 'https';
import type { Orchestrator } from '../orchestrator/index.js';
import {
  listApprovals,
  getApproval,
  approveItem,
  rejectItem,
} from '../services/approval/index.js';

let bot: TelegramBot | null = null;
let orchestratorRef: Orchestrator | null = null;

// Conversation state for /run flow
const conversationState = new Map<number, {
  stage: 'awaiting_pipeline' | 'awaiting_brand' | 'awaiting_inputs';
  pipelineId?: string;
  brandId?: string;
  inputs?: Record<string, string>;
}>();

export function getTelegramBot(): TelegramBot | null {
  return bot;
}

export function initTelegramBot(orchestrator: Orchestrator): TelegramBot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[TelegramBot] TELEGRAM_BOT_TOKEN not set — bot disabled');
    return null;
  }

  orchestratorRef = orchestrator;
  const dataDir = resolve(process.env.SINT_DATA_DIR ?? './data');

  try {
    bot = new TelegramBot(token, { polling: true });
    console.log('[TelegramBot] Bot initialized with polling');
  } catch (err) {
    console.error('[TelegramBot] Failed to initialize:', err);
    return null;
  }

  // ─── /start ───────────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    const dashUrl = process.env.DASHBOARD_URL || 'http://localhost:18789';
    bot!.sendMessage(msg.chat.id,
      `🎯 *Welcome to SINT Marketing Operator*\n\n` +
      `I can help you manage your marketing pipelines, brands, and content approvals.\n\n` +
      `*Commands:*\n` +
      `/pipelines — List available pipelines\n` +
      `/run <pipeline-id> — Start a pipeline run\n` +
      `/brands — List your brands\n` +
      `/status — Check recent runs\n` +
      `/approve — Review pending approvals\n` +
      `/help — Show this message\n\n` +
      `[Open Dashboard](${dashUrl})`,
      { parse_mode: 'Markdown', disable_web_page_preview: true }
    );
  });

  // ─── /help ────────────────────────────────────────────
  bot.onText(/\/help/, (msg) => {
    bot!.sendMessage(msg.chat.id,
      `🎯 *SINT Bot Commands*\n\n` +
      `/pipelines — List pipelines with run buttons\n` +
      `/run <pipeline-id> — Run a pipeline\n` +
      `/brands — List brands\n` +
      `/status — Recent run status\n` +
      `/approve — Pending content approvals\n\n` +
      `📎 Send me a file (image/video/document) to ingest as an asset.`,
      { parse_mode: 'Markdown' }
    );
  });

  // ─── /pipelines ───────────────────────────────────────
  bot.onText(/\/pipelines/, (msg) => {
    const pipelines = orchestratorRef!.listPipelines();
    if (pipelines.length === 0) {
      bot!.sendMessage(msg.chat.id, '📭 No pipelines configured.');
      return;
    }

    const buttons = pipelines.map((p: any) => ([{
      text: `▶️ ${p.name || p.id}`,
      callback_data: `run_pipeline:${p.id}`,
    }]));

    bot!.sendMessage(msg.chat.id,
      `⚡ *Available Pipelines* (${pipelines.length})\n\n` +
      pipelines.map((p: any, i: number) =>
        `${i + 1}. *${p.name || p.id}*\n   ${p.description || 'No description'}`
      ).join('\n\n'),
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons },
      }
    );
  });

  // ─── /brands ──────────────────────────────────────────
  bot.onText(/\/brands/, (msg) => {
    const brands = orchestratorRef!.listBrands();
    if (brands.length === 0) {
      bot!.sendMessage(msg.chat.id, '📭 No brands configured. Create one in the dashboard.');
      return;
    }

    bot!.sendMessage(msg.chat.id,
      `🎨 *Your Brands* (${brands.length})\n\n` +
      brands.map((b: any, i: number) =>
        `${i + 1}. *${b.name}* (${b.id})\n   Platforms: ${(b.platforms || []).map((p: any) => p.platform).join(', ') || 'none'}`
      ).join('\n\n'),
      { parse_mode: 'Markdown' }
    );
  });

  // ─── /status ──────────────────────────────────────────
  bot.onText(/\/status/, (msg) => {
    const runs = orchestratorRef!.listRuns().slice(0, 10);
    if (runs.length === 0) {
      bot!.sendMessage(msg.chat.id, '📭 No recent runs.');
      return;
    }

    const statusIcon = (s: string) => {
      switch (s) {
        case 'completed': return '✅';
        case 'failed': return '❌';
        case 'running': return '🔄';
        case 'queued': return '⏳';
        default: return '❓';
      }
    };

    bot!.sendMessage(msg.chat.id,
      `📊 *Recent Runs*\n\n` +
      runs.map((r: any) =>
        `${statusIcon(r.status)} \`${r.id}\`\n   ${r.pipelineId} — ${r.status}`
      ).join('\n\n'),
      { parse_mode: 'Markdown' }
    );
  });

  // ─── /run <pipeline-id> ──────────────────────────────
  bot.onText(/\/run(?:\s+(.+))?/, (msg, match) => {
    const pipelineId = match?.[1]?.trim();
    const chatId = msg.chat.id;

    if (!pipelineId) {
      // Show pipeline selection
      const pipelines = orchestratorRef!.listPipelines();
      if (pipelines.length === 0) {
        bot!.sendMessage(chatId, '📭 No pipelines available.');
        return;
      }
      const buttons = pipelines.map((p: any) => ([{
        text: p.name || p.id,
        callback_data: `select_pipeline:${p.id}`,
      }]));
      bot!.sendMessage(chatId, '⚡ Select a pipeline to run:', {
        reply_markup: { inline_keyboard: buttons },
      });
      return;
    }

    const pipeline = orchestratorRef!.getPipeline(pipelineId);
    if (!pipeline) {
      bot!.sendMessage(chatId, `❌ Pipeline \`${pipelineId}\` not found.`, { parse_mode: 'Markdown' });
      return;
    }

    // Ask for brand
    const brands = orchestratorRef!.listBrands();
    if (brands.length === 0) {
      bot!.sendMessage(chatId, '❌ No brands configured. Create one in the dashboard first.');
      return;
    }

    conversationState.set(chatId, { stage: 'awaiting_brand', pipelineId });

    const buttons = brands.map((b: any) => ([{
      text: b.name,
      callback_data: `select_brand:${b.id}`,
    }]));
    bot!.sendMessage(chatId, `🎨 Select a brand for *${pipeline.name || pipelineId}*:`, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons },
    });
  });

  // ─── /approve ─────────────────────────────────────────
  bot.onText(/\/approve/, (msg) => {
    const pending = listApprovals({ status: 'pending_review', limit: 10 });
    if (pending.length === 0) {
      bot!.sendMessage(msg.chat.id, '✨ No pending approvals!');
      return;
    }

    for (const item of pending) {
      const preview = item.contentPreview.slice(0, 300);
      bot!.sendMessage(msg.chat.id,
        `📋 *Approval: ${item.id}*\n` +
        `Platform: ${item.platform || 'N/A'}\n` +
        `Pipeline: ${item.pipelineId}\n` +
        `Type: ${item.contentType}\n\n` +
        `${preview}${item.contentPreview.length > 300 ? '...' : ''}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Approve', callback_data: `approve:${item.id}` },
              { text: '❌ Reject', callback_data: `reject:${item.id}` },
            ]],
          },
        }
      );
    }
  });

  // ─── Callback Query Handler ───────────────────────────
  bot.on('callback_query', async (query) => {
    if (!query.data || !query.message) return;
    const chatId = query.message.chat.id;
    const data = query.data;

    try {
      // Pipeline run from /pipelines
      if (data.startsWith('run_pipeline:') || data.startsWith('select_pipeline:')) {
        const pipelineId = data.split(':')[1];
        conversationState.set(chatId, { stage: 'awaiting_brand', pipelineId });

        const brands = orchestratorRef!.listBrands();
        if (brands.length === 0) {
          await bot!.answerCallbackQuery(query.id, { text: 'No brands configured' });
          return;
        }
        const buttons = brands.map((b: any) => ([{
          text: b.name,
          callback_data: `select_brand:${b.id}`,
        }]));
        await bot!.editMessageText(`🎨 Select a brand for *${pipelineId}*:`, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: buttons },
        });
        await bot!.answerCallbackQuery(query.id);
        return;
      }

      // Brand selection
      if (data.startsWith('select_brand:')) {
        const brandId = data.split(':')[1];
        const state = conversationState.get(chatId);
        if (!state?.pipelineId) {
          await bot!.answerCallbackQuery(query.id, { text: 'Session expired. Use /run again.' });
          return;
        }

        conversationState.delete(chatId);

        await bot!.editMessageText(
          `🚀 Starting *${state.pipelineId}* for brand *${brandId}*...`,
          { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
        );

        try {
          const result = await orchestratorRef!.runPipeline(state.pipelineId, brandId, {});
          const outputCount = result.steps.reduce((acc, step) => {
            const output = step.output as { deliverables?: unknown[] } | undefined;
            return acc + (Array.isArray(output?.deliverables) ? output.deliverables.length : 0);
          }, 0);

          await bot!.sendMessage(chatId,
            `✅ *Pipeline Complete*\n\n` +
            `Pipeline: ${state.pipelineId}\nBrand: ${brandId}\n` +
            `Outputs: ${outputCount} deliverables\n\n` +
            `Use /approve to review the content.`,
            { parse_mode: 'Markdown' }
          );
        } catch (err: any) {
          await bot!.sendMessage(chatId,
            `❌ *Pipeline Failed*\n\n${err.message || 'Unknown error'}`,
            { parse_mode: 'Markdown' }
          );
        }

        await bot!.answerCallbackQuery(query.id);
        return;
      }

      // Approve
      if (data.startsWith('approve:')) {
        const id = data.split(':')[1];
        const success = approveItem(id);
        if (success) {
          await bot!.editMessageText(
            query.message.text + '\n\n✅ *APPROVED*',
            { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
          );
        }
        await bot!.answerCallbackQuery(query.id, { text: success ? 'Approved!' : 'Failed to approve' });
        return;
      }

      // Reject
      if (data.startsWith('reject:')) {
        const id = data.split(':')[1];
        const success = rejectItem(id, 'Rejected via Telegram');
        if (success) {
          await bot!.editMessageText(
            query.message.text + '\n\n❌ *REJECTED*',
            { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' }
          );
        }
        await bot!.answerCallbackQuery(query.id, { text: success ? 'Rejected' : 'Failed to reject' });
        return;
      }

      await bot!.answerCallbackQuery(query.id);
    } catch (err) {
      console.error('[TelegramBot] Callback error:', err);
      await bot!.answerCallbackQuery(query.id, { text: 'Error processing action' });
    }
  });

  // ─── File Upload Handler ──────────────────────────────
  const handleFile = async (msg: TelegramBot.Message, fileId: string, fileName: string) => {
    try {
      const filePath = await bot!.getFileLink(fileId);
      const uploadsDir = join(dataDir, 'uploads');
      mkdirSync(uploadsDir, { recursive: true });
      const localPath = join(uploadsDir, `tg_${Date.now()}_${fileName}`);

      await new Promise<void>((res, rej) => {
        const file = createWriteStream(localPath);
        https.get(filePath, (response) => {
          response.pipe(file);
          file.on('finish', () => { file.close(); res(); });
        }).on('error', rej);
      });

      const asset = await orchestratorRef!.uploadAsset(localPath, fileName);
      await bot!.sendMessage(msg.chat.id,
        `📁 Asset ingested: *${fileName}*\nID: \`${asset.id}\``,
        { parse_mode: 'Markdown' }
      );
    } catch (err: any) {
      await bot!.sendMessage(msg.chat.id, `❌ Failed to ingest file: ${err.message}`);
    }
  };

  bot.on('photo', (msg) => {
    if (!msg.photo?.length) return;
    const largest = msg.photo[msg.photo.length - 1];
    handleFile(msg, largest.file_id, `photo_${Date.now()}.jpg`);
  });

  bot.on('video', (msg) => {
    if (!msg.video) return;
    handleFile(msg, msg.video.file_id, msg.video.file_name || `video_${Date.now()}.mp4`);
  });

  bot.on('document', (msg) => {
    if (!msg.document) return;
    handleFile(msg, msg.document.file_id, msg.document.file_name || `doc_${Date.now()}`);
  });

  console.log('[TelegramBot] All handlers registered');
  return bot;
}

/**
 * Send a message to a specific chat (for notifications).
 */
export async function sendBotMessage(chatId: string | number, text: string, options?: any): Promise<void> {
  if (!bot) return;
  await bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...options });
}

/**
 * Stop the bot.
 */
export function stopTelegramBot(): void {
  if (bot) {
    bot.stopPolling();
    bot = null;
  }
}

/**
 * Express webhook handler for Telegram (alternative to polling).
 */
export function telegramWebhook(req: any, res: any): void {
  if (!bot) {
    res.status(503).json({ error: 'Telegram bot not initialized' });
    return;
  }
  try {
    bot.processUpdate(req.body);
    res.sendStatus(200);
  } catch (err) {
    console.error('[TelegramBot] Webhook error:', err);
    res.sendStatus(500);
  }
}
