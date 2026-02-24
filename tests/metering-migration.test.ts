import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { MeteringTracker } from '../src/core/metering/tracker.js';

describe('MeteringTracker legacy migration', () => {
  it('initializes when legacy usage_limits has no daily_cost_limit column', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'sint-metering-'));
    const dbPath = join(tempDir, 'metering.db');

    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE IF NOT EXISTS usage_limits (
        id TEXT PRIMARY KEY DEFAULT 'default',
        enabled INTEGER DEFAULT 1
      );
      INSERT OR IGNORE INTO usage_limits (id, enabled) VALUES ('default', 1);
    `);
    legacyDb.close();

    const tracker = new MeteringTracker(dbPath);
    const limits = tracker.checkLimits();
    tracker.close();

    expect(limits.allowed).toBe(true);
    rmSync(tempDir, { recursive: true, force: true });
  });
});
