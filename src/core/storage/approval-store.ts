import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export type ApprovalStatus = 'draft' | 'pending_review' | 'approved' | 'published' | 'rejected';

export interface Approval {
  id: string;
  runId: string;
  pipelineId: string;
  brandId: string;
  userId: string;
  status: ApprovalStatus;
  contentType: string;
  contentPreview: string;
  contentFull: string;
  platform?: string;
  rejectReason?: string;
  editedContent?: string;
  createdAt: string;
  updatedAt: string;
}

export class ApprovalStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        pipeline_id TEXT NOT NULL,
        brand_id TEXT NOT NULL,
        user_id TEXT NOT NULL DEFAULT 'default',
        status TEXT NOT NULL DEFAULT 'pending_review',
        content_type TEXT NOT NULL DEFAULT 'post',
        content_preview TEXT NOT NULL DEFAULT '',
        content_full TEXT NOT NULL DEFAULT '',
        platform TEXT,
        reject_reason TEXT,
        edited_content TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
      CREATE INDEX IF NOT EXISTS idx_approvals_user ON approvals(user_id);
      CREATE INDEX IF NOT EXISTS idx_approvals_run ON approvals(run_id);
    `);
  }

  save(approval: Approval): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO approvals (id, run_id, pipeline_id, brand_id, user_id, status, content_type, content_preview, content_full, platform, reject_reason, edited_content, created_at, updated_at)
      VALUES (@id, @runId, @pipelineId, @brandId, @userId, @status, @contentType, @contentPreview, @contentFull, @platform, @rejectReason, @editedContent, @createdAt, @updatedAt)
    `).run({
      id: approval.id,
      runId: approval.runId,
      pipelineId: approval.pipelineId,
      brandId: approval.brandId,
      userId: approval.userId,
      status: approval.status,
      contentType: approval.contentType,
      contentPreview: approval.contentPreview,
      contentFull: approval.contentFull,
      platform: approval.platform ?? null,
      rejectReason: approval.rejectReason ?? null,
      editedContent: approval.editedContent ?? null,
      createdAt: approval.createdAt,
      updatedAt: approval.updatedAt,
    });
  }

  get(id: string): Approval | undefined {
    const row = this.db.prepare('SELECT * FROM approvals WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToApproval(row) : undefined;
  }

  list(opts?: { userId?: string; status?: ApprovalStatus; runId?: string; limit?: number }): Approval[] {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (opts?.userId) { conditions.push('user_id = @userId'); params.userId = opts.userId; }
    if (opts?.status) { conditions.push('status = @status'); params.status = opts.status; }
    if (opts?.runId) { conditions.push('run_id = @runId'); params.runId = opts.runId; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = opts?.limit ?? 100;

    const rows = this.db.prepare(`SELECT * FROM approvals ${where} ORDER BY created_at DESC LIMIT ${limit}`).all(params) as Record<string, unknown>[];
    return rows.map(r => this.rowToApproval(r));
  }

  updateStatus(id: string, status: ApprovalStatus, extra?: { rejectReason?: string; editedContent?: string }): boolean {
    const sets = ['status = @status', 'updated_at = @updatedAt'];
    const params: Record<string, unknown> = { id, status, updatedAt: new Date().toISOString() };

    if (extra?.rejectReason !== undefined) {
      sets.push('reject_reason = @rejectReason');
      params.rejectReason = extra.rejectReason;
    }
    if (extra?.editedContent !== undefined) {
      sets.push('edited_content = @editedContent');
      params.editedContent = extra.editedContent;
    }

    const result = this.db.prepare(`UPDATE approvals SET ${sets.join(', ')} WHERE id = @id`).run(params);
    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }

  private rowToApproval(row: Record<string, unknown>): Approval {
    return {
      id: row.id as string,
      runId: row.run_id as string,
      pipelineId: row.pipeline_id as string,
      brandId: row.brand_id as string,
      userId: row.user_id as string,
      status: row.status as ApprovalStatus,
      contentType: row.content_type as string,
      contentPreview: row.content_preview as string,
      contentFull: row.content_full as string,
      platform: (row.platform as string) || undefined,
      rejectReason: (row.reject_reason as string) || undefined,
      editedContent: (row.edited_content as string) || undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
