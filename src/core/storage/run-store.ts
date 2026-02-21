import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export interface AsyncRun {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  pipelineId: string;
  brandId: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

export class RunStore {
  private db: Database.Database;
  private stmtSave: Database.Statement;
  private stmtGet: Database.Statement;
  private stmtDelete: Database.Statement;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        pipeline_id TEXT NOT NULL,
        brand_id TEXT NOT NULL,
        user_id TEXT NOT NULL DEFAULT 'default',
        started_at TEXT NOT NULL,
        completed_at TEXT,
        result TEXT,
        error TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
      CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id);
      CREATE INDEX IF NOT EXISTS idx_runs_started ON runs(started_at);
    `);

    this.stmtSave = this.db.prepare(`
      INSERT OR REPLACE INTO runs (id, status, pipeline_id, brand_id, user_id, started_at, completed_at, result, error)
      VALUES (@id, @status, @pipelineId, @brandId, @userId, @startedAt, @completedAt, @result, @error)
    `);

    this.stmtGet = this.db.prepare('SELECT * FROM runs WHERE id = ?');
    this.stmtDelete = this.db.prepare('DELETE FROM runs WHERE id = ?');
  }

  save(run: AsyncRun): void {
    this.stmtSave.run({
      id: run.id,
      status: run.status,
      pipelineId: run.pipelineId,
      brandId: run.brandId,
      userId: run.userId,
      startedAt: run.startedAt,
      completedAt: run.completedAt ?? null,
      result: run.result !== undefined ? JSON.stringify(run.result) : null,
      error: run.error ?? null,
    });
  }

  get(id: string): AsyncRun | undefined {
    const row = this.stmtGet.get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToRun(row) : undefined;
  }

  list(opts?: { userId?: string; status?: string; pipelineId?: string; brandId?: string; limit?: number }): AsyncRun[] {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (opts?.userId) { conditions.push('user_id = @userId'); params.userId = opts.userId; }
    if (opts?.status) { conditions.push('status = @status'); params.status = opts.status; }
    if (opts?.pipelineId) { conditions.push('pipeline_id LIKE @pipelineId'); params.pipelineId = `%${opts.pipelineId}%`; }
    if (opts?.brandId) { conditions.push('brand_id LIKE @brandId'); params.brandId = `%${opts.brandId}%`; }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = opts?.limit ?? 500;

    const rows = this.db.prepare(`SELECT * FROM runs ${where} ORDER BY started_at DESC LIMIT ${limit}`).all(params) as Record<string, unknown>[];
    return rows.map(r => this.rowToRun(r));
  }

  delete(id: string): void {
    this.stmtDelete.run(id);
  }

  cleanup(retentionMs: number): number {
    const cutoff = new Date(Date.now() - retentionMs).toISOString();
    const result = this.db.prepare(
      "DELETE FROM runs WHERE status IN ('completed', 'failed', 'cancelled') AND started_at < ?"
    ).run(cutoff);
    return result.changes;
  }

  private rowToRun(row: Record<string, unknown>): AsyncRun {
    const run: AsyncRun = {
      id: row.id as string,
      status: row.status as AsyncRun['status'],
      pipelineId: row.pipeline_id as string,
      brandId: row.brand_id as string,
      userId: row.user_id as string,
      startedAt: row.started_at as string,
    };
    if (row.completed_at) run.completedAt = row.completed_at as string;
    if (row.result) {
      try { run.result = JSON.parse(row.result as string); } catch { run.result = row.result; }
    }
    if (row.error) run.error = row.error as string;
    return run;
  }
}
