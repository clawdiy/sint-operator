import Database from 'better-sqlite3';
import { createHash } from 'crypto';

/**
 * Simple LLM response cache. Stores prompt→response mappings in SQLite.
 * Cache key = sha256(prompt + model). TTL-based expiry.
 */
export class LLMCache {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(\`
      CREATE TABLE IF NOT EXISTS llm_cache (
        cache_key TEXT PRIMARY KEY,
        model TEXT NOT NULL,
        prompt_hash TEXT NOT NULL,
        response TEXT NOT NULL,
        tokens_saved INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cache_expires ON llm_cache(expires_at);
    \`);
  }

  private makeKey(prompt: string, model: string): string {
    return createHash('sha256').update(prompt + '::' + model).digest('hex');
  }

  get(prompt: string, model: string): string | null {
    const key = this.makeKey(prompt, model);
    const row = this.db.prepare(
      'SELECT response FROM llm_cache WHERE cache_key = ? AND expires_at > datetime("now")'
    ).get(key) as any;
    return row ? row.response : null;
  }

  set(prompt: string, model: string, response: string, tokens: number, ttlHours: number = 24): void {
    const key = this.makeKey(prompt, model);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
    this.db.prepare(\`
      INSERT OR REPLACE INTO llm_cache (cache_key, model, prompt_hash, response, tokens_saved, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    \`).run(key, model, key.slice(0, 16), response, tokens, expiresAt);
  }

  getStats(): { entries: number; tokensSaved: number } {
    const row = this.db.prepare(
      'SELECT COUNT(*) as entries, COALESCE(SUM(tokens_saved), 0) as tokensSaved FROM llm_cache WHERE expires_at > datetime("now")'
    ).get() as any;
    return { entries: row.entries, tokensSaved: row.tokensSaved };
  }

  cleanup(): number {
    const result = this.db.prepare('DELETE FROM llm_cache WHERE expires_at <= datetime("now")').run();
    return result.changes;
  }
}
