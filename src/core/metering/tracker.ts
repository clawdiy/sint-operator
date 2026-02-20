/**
 * Local Metering — SQLite WAL mode
 * 
 * Zero-config usage tracking with hard stops and audit trail.
 * Tracks per-model, per-pipeline, per-brand usage.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { MeterEntry, UsageSummary, ModelTier } from '../types.js';

export class MeteringTracker {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meter_entries (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        step_id TEXT NOT NULL,
        pipeline_id TEXT DEFAULT '',
        brand_id TEXT DEFAULT '',
        model TEXT NOT NULL,
        tier TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost_units REAL NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_meter_run ON meter_entries(run_id);
      CREATE INDEX IF NOT EXISTS idx_meter_timestamp ON meter_entries(timestamp);
      CREATE INDEX IF NOT EXISTS idx_meter_model ON meter_entries(model);

      CREATE TABLE IF NOT EXISTS usage_limits (
        id TEXT PRIMARY KEY DEFAULT 'default',
        daily_cost_limit REAL DEFAULT 100.0,
        monthly_cost_limit REAL DEFAULT 2000.0,
        per_run_cost_limit REAL DEFAULT 50.0,
        enabled INTEGER DEFAULT 1
      );

      INSERT OR IGNORE INTO usage_limits (id) VALUES ('default');
    `);
  }

  // ─── Recording ──────────────────────────────────────────

  record(entry: MeterEntry & { pipelineId?: string; brandId?: string }): void {
    const stmt = this.db.prepare(`
      INSERT INTO meter_entries (id, run_id, step_id, pipeline_id, brand_id, model, tier, input_tokens, output_tokens, cost_units, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entry.id,
      entry.runId,
      entry.stepId,
      entry.pipelineId ?? '',
      entry.brandId ?? '',
      entry.model,
      entry.tier,
      entry.inputTokens,
      entry.outputTokens,
      entry.costUnits,
      entry.timestamp
    );
  }

  // ─── Limits ─────────────────────────────────────────────

  checkLimits(): { allowed: boolean; reason?: string } {
    const limits = this.db.prepare('SELECT * FROM usage_limits WHERE id = ?').get('default') as any;
    if (!limits?.enabled) return { allowed: true };

    // Daily limit
    const dailyUsage = this.db.prepare(`
      SELECT COALESCE(SUM(cost_units), 0) as total
      FROM meter_entries
      WHERE timestamp >= datetime('now', '-1 day')
    `).get() as { total: number };

    if (dailyUsage.total >= limits.daily_cost_limit) {
      return { allowed: false, reason: `Daily cost limit reached: ${dailyUsage.total.toFixed(1)}/${limits.daily_cost_limit}` };
    }

    // Monthly limit
    const monthlyUsage = this.db.prepare(`
      SELECT COALESCE(SUM(cost_units), 0) as total
      FROM meter_entries
      WHERE timestamp >= datetime('now', '-30 days')
    `).get() as { total: number };

    if (monthlyUsage.total >= limits.monthly_cost_limit) {
      return { allowed: false, reason: `Monthly cost limit reached: ${monthlyUsage.total.toFixed(1)}/${limits.monthly_cost_limit}` };
    }

    return { allowed: true };
  }

  setLimits(limits: { daily?: number; monthly?: number; perRun?: number }): void {
    const updates: string[] = [];
    const values: unknown[] = [];

    if (limits.daily !== undefined) {
      updates.push('daily_cost_limit = ?');
      values.push(limits.daily);
    }
    if (limits.monthly !== undefined) {
      updates.push('monthly_cost_limit = ?');
      values.push(limits.monthly);
    }
    if (limits.perRun !== undefined) {
      updates.push('per_run_cost_limit = ?');
      values.push(limits.perRun);
    }

    if (updates.length > 0) {
      this.db.prepare(`UPDATE usage_limits SET ${updates.join(', ')} WHERE id = 'default'`).run(...values);
    }
  }

  // ─── Reporting ──────────────────────────────────────────

  getSummary(periodDays: number = 30): UsageSummary {
    const rows = this.db.prepare(`
      SELECT * FROM meter_entries
      WHERE timestamp >= datetime('now', '-${periodDays} days')
    `).all() as Array<{
      run_id: string; pipeline_id: string; brand_id: string;
      model: string; tier: string; input_tokens: number;
      output_tokens: number; cost_units: number;
    }>;

    const byModel: Record<string, { tokens: number; costUnits: number; runs: number }> = {};
    const byPipeline: Record<string, { runs: number; costUnits: number }> = {};
    const byBrand: Record<string, { runs: number; costUnits: number }> = {};
    const runIds = new Set<string>();

    let totalTokens = 0;
    let totalCostUnits = 0;

    for (const row of rows) {
      const tokens = row.input_tokens + row.output_tokens;
      totalTokens += tokens;
      totalCostUnits += row.cost_units;
      runIds.add(row.run_id);

      // By model
      if (!byModel[row.model]) byModel[row.model] = { tokens: 0, costUnits: 0, runs: 0 };
      byModel[row.model].tokens += tokens;
      byModel[row.model].costUnits += row.cost_units;
      byModel[row.model].runs += 1;

      // By pipeline
      if (row.pipeline_id) {
        if (!byPipeline[row.pipeline_id]) byPipeline[row.pipeline_id] = { runs: 0, costUnits: 0 };
        byPipeline[row.pipeline_id].costUnits += row.cost_units;
        byPipeline[row.pipeline_id].runs += 1;
      }

      // By brand
      if (row.brand_id) {
        if (!byBrand[row.brand_id]) byBrand[row.brand_id] = { runs: 0, costUnits: 0 };
        byBrand[row.brand_id].costUnits += row.cost_units;
        byBrand[row.brand_id].runs += 1;
      }
    }

    return {
      period: `${periodDays}d`,
      totalRuns: runIds.size,
      totalTokens,
      totalCostUnits,
      byModel,
      byPipeline,
      byBrand,
    };
  }

  getRunCost(runId: string): number {
    const result = this.db.prepare(`
      SELECT COALESCE(SUM(cost_units), 0) as total FROM meter_entries WHERE run_id = ?
    `).get(runId) as { total: number };
    return result.total;
  }

  close(): void {
    this.db.close();
  }
}
