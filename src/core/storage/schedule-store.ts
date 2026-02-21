import Database from 'better-sqlite3';
import { join } from 'path';

export interface ScheduledRun {
  id: string;
  pipelineId: string;
  brandId: string;
  inputs: Record<string, unknown>;
  cronExpression?: string;  // e.g., "0 9 * * MON" = every Monday 9am
  nextRunAt: string;
  lastRunAt?: string;
  enabled: boolean;
  userId: string;
  createdAt: string;
}

export class ScheduleStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        pipeline_id TEXT NOT NULL,
        brand_id TEXT NOT NULL,
        inputs TEXT DEFAULT '{}',
        cron_expression TEXT,
        next_run_at TEXT NOT NULL,
        last_run_at TEXT,
        enabled INTEGER DEFAULT 1,
        user_id TEXT NOT NULL DEFAULT 'default',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_schedules_next ON schedules(next_run_at) WHERE enabled = 1;
    `);
  }

  save(schedule: ScheduledRun): void {
    this.db.prepare(\`
      INSERT OR REPLACE INTO schedules (id, pipeline_id, brand_id, inputs, cron_expression, next_run_at, last_run_at, enabled, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    \`).run(
      schedule.id, schedule.pipelineId, schedule.brandId,
      JSON.stringify(schedule.inputs), schedule.cronExpression || null,
      schedule.nextRunAt, schedule.lastRunAt || null,
      schedule.enabled ? 1 : 0, schedule.userId, schedule.createdAt
    );
  }

  get(id: string): ScheduledRun | undefined {
    const row = this.db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as any;
    return row ? this.rowToSchedule(row) : undefined;
  }

  list(opts?: { userId?: string; enabled?: boolean }): ScheduledRun[] {
    let sql = 'SELECT * FROM schedules WHERE 1=1';
    const params: unknown[] = [];
    if (opts?.userId) { sql += ' AND user_id = ?'; params.push(opts.userId); }
    if (opts?.enabled !== undefined) { sql += ' AND enabled = ?'; params.push(opts.enabled ? 1 : 0); }
    sql += ' ORDER BY next_run_at ASC';
    return (this.db.prepare(sql).all(...params) as any[]).map(r => this.rowToSchedule(r));
  }

  getDue(): ScheduledRun[] {
    const now = new Date().toISOString();
    return (this.db.prepare('SELECT * FROM schedules WHERE enabled = 1 AND next_run_at <= ? ORDER BY next_run_at ASC')
      .all(now) as any[]).map(r => this.rowToSchedule(r));
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM schedules WHERE id = ?').run(id);
  }

  private rowToSchedule(row: any): ScheduledRun {
    return {
      id: row.id,
      pipelineId: row.pipeline_id,
      brandId: row.brand_id,
      inputs: JSON.parse(row.inputs || '{}'),
      cronExpression: row.cron_expression,
      nextRunAt: row.next_run_at,
      lastRunAt: row.last_run_at,
      enabled: !!row.enabled,
      userId: row.user_id,
      createdAt: row.created_at,
    };
  }
}
