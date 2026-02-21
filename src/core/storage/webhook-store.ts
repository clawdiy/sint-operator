import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export interface PersistedWebhookEvent {
  id: string;
  userId: string;
  source: string;
  event: string;
  brandId?: string;
  runId?: string;
  data?: Record<string, unknown>;
  receivedAt: string;
}

export class WebhookStore {
  private db: Database.Database;
  private stmtSave: Database.Statement;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        source TEXT NOT NULL,
        event TEXT NOT NULL,
        brand_id TEXT,
        run_id TEXT,
        data_json TEXT,
        received_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_webhooks_user_received ON webhooks(user_id, received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_webhooks_source ON webhooks(source);
      CREATE INDEX IF NOT EXISTS idx_webhooks_event ON webhooks(event);
    `);

    this.stmtSave = this.db.prepare(`
      INSERT OR REPLACE INTO webhooks (
        id, user_id, source, event, brand_id, run_id, data_json, received_at
      ) VALUES (
        @id, @userId, @source, @event, @brandId, @runId, @dataJson, @receivedAt
      )
    `);
  }

  save(event: PersistedWebhookEvent): void {
    this.stmtSave.run({
      id: event.id,
      userId: event.userId,
      source: event.source,
      event: event.event,
      brandId: event.brandId ?? null,
      runId: event.runId ?? null,
      dataJson: event.data ? JSON.stringify(event.data) : null,
      receivedAt: event.receivedAt,
    });
  }

  list(options: {
    userId: string;
    source?: string;
    event?: string;
    limit?: number;
  }): PersistedWebhookEvent[] {
    const conditions = ['user_id = @userId'];
    const params: Record<string, unknown> = {
      userId: options.userId,
    };

    if (options.source) {
      conditions.push('source = @source');
      params.source = options.source;
    }
    if (options.event) {
      conditions.push('event = @event');
      params.event = options.event;
    }

    const limit = Math.max(1, Math.min(options.limit ?? 50, 500));
    const rows = this.db.prepare(`
      SELECT id, user_id, source, event, brand_id, run_id, data_json, received_at
      FROM webhooks
      WHERE ${conditions.join(' AND ')}
      ORDER BY received_at DESC
      LIMIT ${limit}
    `).all(params) as Record<string, unknown>[];

    return rows.map(row => this.rowToEvent(row));
  }

  countByUser(userId: string): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) as total FROM webhooks WHERE user_id = ?'
    ).get(userId) as { total: number } | undefined;
    return row?.total ?? 0;
  }

  trimUserEvents(userId: string, maxEvents: number): void {
    if (maxEvents <= 0) return;

    this.db.prepare(`
      DELETE FROM webhooks
      WHERE user_id = @userId
        AND id IN (
          SELECT id
          FROM webhooks
          WHERE user_id = @userId
          ORDER BY received_at DESC
          LIMIT -1 OFFSET @offset
        )
    `).run({
      userId,
      offset: maxEvents,
    });
  }

  close(): void {
    this.db.close();
  }

  private rowToEvent(row: Record<string, unknown>): PersistedWebhookEvent {
    const event: PersistedWebhookEvent = {
      id: String(row.id),
      userId: String(row.user_id),
      source: String(row.source),
      event: String(row.event),
      receivedAt: String(row.received_at),
    };

    if (row.brand_id) event.brandId = String(row.brand_id);
    if (row.run_id) event.runId = String(row.run_id);
    if (row.data_json) {
      try {
        const parsed = JSON.parse(String(row.data_json));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          event.data = parsed as Record<string, unknown>;
        }
      } catch {
        // Keep event readable even if stored JSON is malformed.
      }
    }

    return event;
  }
}
