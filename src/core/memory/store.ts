/**
 * Dual-layer Memory Store
 * 
 * SQLite FTS5 for precise keyword search + in-memory vector store
 * for semantic similarity. Local-first — no external dependencies.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { MemoryService, MemoryResult, LLMService } from '../types.js';

interface StoredEntry {
  id: string;
  collection: string;
  text: string;
  embedding: string;  // JSON array
  metadata: string;    // JSON
  created_at: string;
}

export class MemoryStore implements MemoryService {
  private db: Database.Database;
  private llm: LLMService | null = null;
  private embedCache = new Map<string, number[]>();

  constructor(dbPath: string) {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  setLLM(llm: LLMService): void {
    this.llm = llm;
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL,
        text TEXT NOT NULL,
        embedding TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_memories_collection ON memories(collection);

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        id UNINDEXED,
        collection UNINDEXED,
        text,
        content='memories',
        content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, id, collection, text)
        VALUES (new.rowid, new.id, new.collection, new.text);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, id, collection, text)
        VALUES ('delete', old.rowid, old.id, old.collection, old.text);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, id, collection, text)
        VALUES ('delete', old.rowid, old.id, old.collection, old.text);
        INSERT INTO memories_fts(rowid, id, collection, text)
        VALUES (new.rowid, new.id, new.collection, new.text);
      END;
    `);
  }

  async store(
    collection: string,
    id: string,
    text: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    let embedding: number[] = [];
    
    if (this.llm) {
      try {
        embedding = await this.llm.embedText(text);
        this.embedCache.set(`${collection}:${id}`, embedding);
      } catch {
        // Embeddings are optional — graceful degradation to FTS only
      }
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memories (id, collection, text, embedding, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);

    stmt.run(id, collection, text, JSON.stringify(embedding), JSON.stringify(metadata ?? {}));
  }

  async search(
    collection: string,
    query: string,
    limit: number = 10
  ): Promise<MemoryResult[]> {
    // Layer 1: FTS5 keyword search
    const ftsResults = this.ftsSearch(collection, query, limit * 2);

    // Layer 2: Semantic search (if embeddings available)
    let semanticResults: MemoryResult[] = [];
    if (this.llm) {
      try {
        semanticResults = await this.semanticSearch(collection, query, limit * 2);
      } catch {
        // Fall back to FTS only
      }
    }

    // Merge and deduplicate, preferring higher scores
    const merged = new Map<string, MemoryResult>();
    
    for (const r of [...ftsResults, ...semanticResults]) {
      const existing = merged.get(r.id);
      if (!existing || r.score > existing.score) {
        merged.set(r.id, r);
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async get(collection: string, id: string): Promise<MemoryResult | null> {
    const stmt = this.db.prepare(
      'SELECT * FROM memories WHERE collection = ? AND id = ?'
    );
    const row = stmt.get(collection, id) as StoredEntry | undefined;
    
    if (!row) return null;
    
    return {
      id: row.id,
      text: row.text,
      score: 1.0,
      metadata: JSON.parse(row.metadata),
    };
  }

  async delete(collection: string, id: string): Promise<void> {
    const stmt = this.db.prepare(
      'DELETE FROM memories WHERE collection = ? AND id = ?'
    );
    stmt.run(collection, id);
    this.embedCache.delete(`${collection}:${id}`);
  }

  // ─── Internal Search Methods ──────────────────────────────

  private ftsSearch(collection: string, query: string, limit: number): MemoryResult[] {
    try {
      // Escape FTS5 special characters
      const safeQuery = query.replace(/['"]/g, ' ').trim();
      if (!safeQuery) return [];

      const stmt = this.db.prepare(`
        SELECT m.id, m.text, m.metadata, rank
        FROM memories_fts f
        JOIN memories m ON f.id = m.id
        WHERE memories_fts MATCH ? AND m.collection = ?
        ORDER BY rank
        LIMIT ?
      `);

      const rows = stmt.all(safeQuery, collection, limit) as Array<{
        id: string; text: string; metadata: string; rank: number;
      }>;

      return rows.map(r => ({
        id: r.id,
        text: r.text,
        score: Math.abs(r.rank), // FTS5 rank is negative
        metadata: JSON.parse(r.metadata),
      }));
    } catch {
      return [];
    }
  }

  private async semanticSearch(
    collection: string,
    query: string,
    limit: number
  ): Promise<MemoryResult[]> {
    const queryEmbedding = await this.llm!.embedText(query);

    const stmt = this.db.prepare(
      'SELECT id, text, embedding, metadata FROM memories WHERE collection = ?'
    );
    const rows = stmt.all(collection) as StoredEntry[];

    const scored = rows
      .map(row => {
        const embedding = JSON.parse(row.embedding) as number[];
        if (embedding.length === 0) return null;
        
        const score = cosineSimilarity(queryEmbedding, embedding);
        return {
          id: row.id,
          text: row.text,
          score,
          metadata: JSON.parse(row.metadata),
        };
      })
      .filter((r): r is MemoryResult => r !== null && r.score > 0.3);

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  close(): void {
    this.db.close();
  }
}

// ─── Vector Math ──────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
