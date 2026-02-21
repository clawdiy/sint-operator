import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export interface PersistedNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  runId?: string;
  read: boolean;
  createdAt: string;
}

export class NotificationStore {
  private db: Database.Database;
  private stmtSave: Database.Statement;
  private stmtMarkRead: Database.Statement;
  private stmtMarkAllRead: Database.Statement;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        run_id TEXT,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created
        ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_read
        ON notifications(user_id, is_read, created_at DESC);
    `);

    this.stmtSave = this.db.prepare(`
      INSERT OR REPLACE INTO notifications (
        id, user_id, type, title, message, run_id, is_read, created_at
      ) VALUES (
        @id, @userId, @type, @title, @message, @runId, @isRead, @createdAt
      )
    `);

    this.stmtMarkRead = this.db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = @userId AND id = @id
    `);

    this.stmtMarkAllRead = this.db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE user_id = @userId
    `);
  }

  save(item: PersistedNotification): void {
    this.stmtSave.run({
      id: item.id,
      userId: item.userId,
      type: item.type,
      title: item.title,
      message: item.message,
      runId: item.runId ?? null,
      isRead: item.read ? 1 : 0,
      createdAt: item.createdAt,
    });
  }

  list(options: {
    userId: string;
    unreadOnly?: boolean;
    limit?: number;
  }): PersistedNotification[] {
    const unreadOnly = !!options.unreadOnly;
    const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
    const rows = this.db.prepare(`
      SELECT id, user_id, type, title, message, run_id, is_read, created_at
      FROM notifications
      WHERE user_id = @userId
        ${unreadOnly ? 'AND is_read = 0' : ''}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `).all({ userId: options.userId }) as Record<string, unknown>[];
    return rows.map((row) => this.rowToNotification(row));
  }

  markRead(userId: string, id: string): void {
    this.stmtMarkRead.run({ userId, id });
  }

  markAllRead(userId: string): void {
    this.stmtMarkAllRead.run({ userId });
  }

  trimUserNotifications(userId: string, keepLatest: number): void {
    if (keepLatest <= 0) return;

    this.db.prepare(`
      DELETE FROM notifications
      WHERE user_id = @userId
        AND id IN (
          SELECT id
          FROM notifications
          WHERE user_id = @userId
          ORDER BY created_at DESC
          LIMIT -1 OFFSET @offset
        )
    `).run({
      userId,
      offset: keepLatest,
    });
  }

  close(): void {
    this.db.close();
  }

  private rowToNotification(row: Record<string, unknown>): PersistedNotification {
    const item: PersistedNotification = {
      id: String(row.id),
      userId: String(row.user_id),
      type: String(row.type),
      title: String(row.title),
      message: String(row.message),
      read: Number(row.is_read ?? 0) === 1,
      createdAt: String(row.created_at),
    };
    if (row.run_id) {
      item.runId = String(row.run_id);
    }
    return item;
  }
}
