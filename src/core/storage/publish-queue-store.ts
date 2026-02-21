import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export type PublishQueueStatus = 'pending' | 'published' | 'failed' | 'cancelled';

export interface PersistedPublishQueueItem {
  id: string;
  userId: string;
  request: Record<string, unknown>;
  brandId: string;
  runId?: string;
  scheduledAt?: string;
  status: PublishQueueStatus;
  result?: Record<string, unknown>;
  attemptCount: number;
  nextAttemptAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export class PublishQueueStore {
  private db: Database.Database;
  private stmtSave: Database.Statement;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS publish_queue (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        request_json TEXT NOT NULL,
        brand_id TEXT NOT NULL,
        run_id TEXT,
        scheduled_at TEXT,
        status TEXT NOT NULL,
        result_json TEXT,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_publish_queue_user ON publish_queue(user_id);
      CREATE INDEX IF NOT EXISTS idx_publish_queue_status ON publish_queue(status);
      CREATE INDEX IF NOT EXISTS idx_publish_queue_schedule ON publish_queue(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_publish_queue_next_attempt ON publish_queue(next_attempt_at);
    `);

    this.stmtSave = this.db.prepare(`
      INSERT OR REPLACE INTO publish_queue (
        id, user_id, request_json, brand_id, run_id, scheduled_at, status, result_json,
        attempt_count, next_attempt_at, last_error, created_at, updated_at
      ) VALUES (
        @id, @userId, @requestJson, @brandId, @runId, @scheduledAt, @status, @resultJson,
        @attemptCount, @nextAttemptAt, @lastError, @createdAt, @updatedAt
      )
    `);
  }

  save(item: PersistedPublishQueueItem): void {
    this.stmtSave.run({
      id: item.id,
      userId: item.userId,
      requestJson: JSON.stringify(item.request),
      brandId: item.brandId,
      runId: item.runId ?? null,
      scheduledAt: item.scheduledAt ?? null,
      status: item.status,
      resultJson: item.result ? JSON.stringify(item.result) : null,
      attemptCount: item.attemptCount,
      nextAttemptAt: item.nextAttemptAt ?? null,
      lastError: item.lastError ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  }

  list(options?: {
    userId?: string;
    status?: PublishQueueStatus;
    brandId?: string;
    dueBefore?: string;
    limit?: number;
  }): PersistedPublishQueueItem[] {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options?.userId) {
      conditions.push('user_id = @userId');
      params.userId = options.userId;
    }
    if (options?.status) {
      conditions.push('status = @status');
      params.status = options.status;
    }
    if (options?.brandId) {
      conditions.push('brand_id LIKE @brandId');
      params.brandId = `%${options.brandId}%`;
    }
    if (options?.dueBefore) {
      conditions.push(`(
        (scheduled_at IS NULL OR scheduled_at <= @dueBefore)
        AND (next_attempt_at IS NULL OR next_attempt_at <= @dueBefore)
      )`);
      params.dueBefore = options.dueBefore;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit ?? 250;

    const rows = this.db.prepare(`
      SELECT * FROM publish_queue
      ${where}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `).all(params) as Record<string, unknown>[];

    return rows.map(row => this.rowToItem(row));
  }

  get(id: string): PersistedPublishQueueItem | undefined {
    const row = this.db.prepare('SELECT * FROM publish_queue WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToItem(row) : undefined;
  }

  close(): void {
    this.db.close();
  }

  private rowToItem(row: Record<string, unknown>): PersistedPublishQueueItem {
    const item: PersistedPublishQueueItem = {
      id: String(row.id),
      userId: String(row.user_id),
      request: this.parseJson(row.request_json),
      brandId: String(row.brand_id),
      status: String(row.status) as PublishQueueStatus,
      attemptCount: Number(row.attempt_count ?? 0),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
    if (row.run_id) item.runId = String(row.run_id);
    if (row.scheduled_at) item.scheduledAt = String(row.scheduled_at);
    if (row.result_json) item.result = this.parseJson(row.result_json);
    if (row.next_attempt_at) item.nextAttemptAt = String(row.next_attempt_at);
    if (row.last_error) item.lastError = String(row.last_error);
    return item;
  }

  private parseJson(value: unknown): Record<string, unknown> {
    if (typeof value !== 'string') return {};
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}
