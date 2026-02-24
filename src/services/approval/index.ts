/**
 * Content Approval Workflow Service
 *
 * States: draft → pending_review → approved → published → rejected
 * Creates approval entries after pipeline runs complete.
 * Notifies via Telegram/WhatsApp when content needs approval.
 */

import { nanoid } from 'nanoid';
import { join, resolve } from 'path';
import { ApprovalStore, type Approval, type ApprovalStatus } from '../../core/storage/approval-store.js';
import { sendTelegramMessage } from '../../skills/notifier/telegram.js';

let approvalStore: ApprovalStore | null = null;

export function initApprovalStore(dataDir: string): void {
  if (approvalStore) return;
  approvalStore = new ApprovalStore(join(dataDir, 'approvals.db'));
}

export function closeApprovalStore(): void {
  approvalStore?.close();
  approvalStore = null;
}

export function getApprovalStore(): ApprovalStore | null {
  return approvalStore;
}

/**
 * Create approval entries from a completed pipeline run result.
 */
export function createApprovalsFromRun(opts: {
  runId: string;
  pipelineId: string;
  brandId: string;
  userId: string;
  result: unknown;
}): Approval[] {
  if (!approvalStore) return [];

  const created: Approval[] = [];
  const result = opts.result as Record<string, unknown> | null;
  if (!result) return [];

  const steps = Array.isArray(result.steps) ? result.steps : [];

  for (const step of steps) {
    const output = (step as Record<string, unknown>)?.output as Record<string, unknown> | undefined;
    if (!output) continue;

    // Extract deliverables
    const deliverables = Array.isArray(output.deliverables) ? output.deliverables : [];
    for (const d of deliverables) {
      const del = d as Record<string, unknown>;
      const content = String(del.content || '');
      if (!content) continue;

      const approval: Approval = {
        id: `apr_${nanoid(10)}`,
        runId: opts.runId,
        pipelineId: opts.pipelineId,
        brandId: opts.brandId,
        userId: opts.userId,
        status: 'pending_review',
        contentType: 'social_post',
        contentPreview: content.slice(0, 200),
        contentFull: content,
        platform: String(del.platform || 'unknown'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      approvalStore.save(approval);
      created.push(approval);
    }

    // Extract articles
    if (output.article) {
      const article = output.article as Record<string, unknown>;
      const content = String(article.content || '');
      const title = String(article.title || 'Article');
      if (content) {
        const approval: Approval = {
          id: `apr_${nanoid(10)}`,
          runId: opts.runId,
          pipelineId: opts.pipelineId,
          brandId: opts.brandId,
          userId: opts.userId,
          status: 'pending_review',
          contentType: 'article',
          contentPreview: `${title}\n${content.slice(0, 150)}`,
          contentFull: `# ${title}\n\n${content}`,
          platform: 'blog',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        approvalStore.save(approval);
        created.push(approval);
      }
    }
  }

  // Notify via Telegram if configured
  if (created.length > 0 && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    const msg = `📋 <b>${created.length} item(s) need approval</b>\n\n` +
      `Pipeline: ${opts.pipelineId}\nBrand: ${opts.brandId}\nRun: <code>${opts.runId}</code>\n\n` +
      `Use /approve in the bot to review.`;
    void sendTelegramMessage(msg, 'HTML');
  }

  return created;
}

/**
 * Approve an item.
 */
export function approveItem(id: string): boolean {
  if (!approvalStore) return false;
  return approvalStore.updateStatus(id, 'approved');
}

/**
 * Reject an item with reason.
 */
export function rejectItem(id: string, reason: string): boolean {
  if (!approvalStore) return false;
  return approvalStore.updateStatus(id, 'rejected', { rejectReason: reason });
}

/**
 * Edit content before approving.
 */
export function editItem(id: string, editedContent: string): boolean {
  if (!approvalStore) return false;
  return approvalStore.updateStatus(id, 'approved', { editedContent });
}

/**
 * List approvals.
 */
export function listApprovals(opts?: { userId?: string; status?: ApprovalStatus; limit?: number }): Approval[] {
  if (!approvalStore) return [];
  return approvalStore.list(opts);
}

/**
 * Get single approval.
 */
export function getApproval(id: string): Approval | undefined {
  return approvalStore?.get(id);
}
