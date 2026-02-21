import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import Database from 'better-sqlite3';
import type {
  PublishQueueItem,
  PublishQueueStatus,
  PublishRequest,
  PublishResult,
} from './types.js';

type PublishQueueRow = {
  id: string;
  platform: string;
  content: string;
  hashtags_json: string | null;
  media_json: string | null;
  article_url: string | null;
  article_title: string | null;
  article_description: string | null;
  is_thread: number;
  brand_id: string;
  run_id: string | null;
  scheduled_at: string | null;
  status: PublishQueueStatus;
  result_json: string | null;
  requires_approval: number;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

let db: Database.Database | null = null;
let dbPath = '';
let dataRoot = resolve(process.env.SINT_DATA_DIR ?? './data');

function ensureDataDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function initTables(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS publish_queue (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      content TEXT NOT NULL,
      hashtags_json TEXT,
      media_json TEXT,
      article_url TEXT,
      article_title TEXT,
      article_description TEXT,
      is_thread INTEGER NOT NULL DEFAULT 0,
      brand_id TEXT NOT NULL,
      run_id TEXT,
      scheduled_at TEXT,
      status TEXT NOT NULL,
      result_json TEXT,
      requires_approval INTEGER NOT NULL DEFAULT 0,
      approved_by TEXT,
      approved_at TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_publish_queue_status ON publish_queue(status);
    CREATE INDEX IF NOT EXISTS idx_publish_queue_brand ON publish_queue(brand_id);
    CREATE INDEX IF NOT EXISTS idx_publish_queue_created ON publish_queue(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_publish_queue_scheduled ON publish_queue(scheduled_at);
  `);
}

function ensureDb(): Database.Database {
  if (!db) {
    initPublishStore(dataRoot);
  }
  if (!db) {
    throw new Error('Publish queue DB not initialized');
  }
  return db;
}

function safeJsonParse<T>(input: string | null): T | undefined {
  if (!input) return undefined;
  try {
    return JSON.parse(input) as T;
  } catch {
    return undefined;
  }
}

function rowToItem(row: PublishQueueRow): PublishQueueItem {
  const hashtags = safeJsonParse<string[]>(row.hashtags_json);
  const media = safeJsonParse<string[]>(row.media_json);
  const result = safeJsonParse<PublishResult>(row.result_json);

  return {
    id: row.id,
    request: {
      platform: row.platform as PublishRequest['platform'],
      content: row.content,
      hashtags,
      media,
      articleUrl: row.article_url ?? undefined,
      articleTitle: row.article_title ?? undefined,
      articleDescription: row.article_description ?? undefined,
      isThread: row.is_thread === 1,
    },
    brandId: row.brand_id,
    runId: row.run_id ?? undefined,
    scheduledAt: row.scheduled_at ?? undefined,
    status: row.status,
    result,
    requiresApproval: row.requires_approval === 1,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function initPublishStore(dataDir: string): void {
  const resolved = resolve(dataDir);
  const targetDbPath = join(resolved, 'publish.db');

  if (db && dbPath === targetDbPath) {
    return;
  }

  if (db) {
    db.close();
    db = null;
  }

  ensureDataDir(resolved);
  const database = new Database(targetDbPath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  initTables(database);

  db = database;
  dbPath = targetDbPath;
  dataRoot = resolved;
}

export function insertQueueItem(params: {
  id: string;
  request: PublishRequest;
  brandId: string;
  runId?: string;
  scheduledAt?: string;
  status: PublishQueueStatus;
  requiresApproval: boolean;
}): PublishQueueItem {
  const database = ensureDb();
  const now = new Date().toISOString();

  database.prepare(`
    INSERT INTO publish_queue (
      id, platform, content, hashtags_json, media_json,
      article_url, article_title, article_description, is_thread,
      brand_id, run_id, scheduled_at, status, result_json,
      requires_approval, approved_by, approved_at, rejection_reason,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.id,
    params.request.platform,
    params.request.content,
    params.request.hashtags ? JSON.stringify(params.request.hashtags) : null,
    params.request.media ? JSON.stringify(params.request.media) : null,
    params.request.articleUrl ?? null,
    params.request.articleTitle ?? null,
    params.request.articleDescription ?? null,
    params.request.isThread ? 1 : 0,
    params.brandId,
    params.runId ?? null,
    params.scheduledAt ?? null,
    params.status,
    null,
    params.requiresApproval ? 1 : 0,
    null,
    null,
    null,
    now,
    now,
  );

  const row = database
    .prepare('SELECT * FROM publish_queue WHERE id = ?')
    .get(params.id) as PublishQueueRow | undefined;
  if (!row) throw new Error(`Queue item ${params.id} not found after insert`);
  return rowToItem(row);
}

export function getQueueItem(id: string): PublishQueueItem | null {
  const database = ensureDb();
  const row = database
    .prepare('SELECT * FROM publish_queue WHERE id = ?')
    .get(id) as PublishQueueRow | undefined;
  return row ? rowToItem(row) : null;
}

export function listQueueItems(filters?: { status?: string; brandId?: string }): PublishQueueItem[] {
  const database = ensureDb();
  const where: string[] = [];
  const values: string[] = [];

  if (filters?.status) {
    where.push('status = ?');
    values.push(filters.status);
  }
  if (filters?.brandId) {
    where.push('brand_id = ?');
    values.push(filters.brandId);
  }

  const query = `
    SELECT * FROM publish_queue
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY created_at DESC
  `;
  const rows = database.prepare(query).all(...values) as PublishQueueRow[];
  return rows.map(rowToItem);
}

export function updateQueueItem(
  id: string,
  updates: {
    status?: PublishQueueStatus;
    result?: PublishResult;
    approvedBy?: string | null;
    approvedAt?: string | null;
    rejectionReason?: string | null;
  },
): PublishQueueItem | null {
  const database = ensureDb();
  const existing = getQueueItem(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const nextStatus = updates.status ?? existing.status;
  const nextResult = updates.result ?? existing.result;
  const approvedBy = updates.approvedBy === undefined
    ? existing.approvedBy ?? null
    : updates.approvedBy;
  const approvedAt = updates.approvedAt === undefined
    ? existing.approvedAt ?? null
    : updates.approvedAt;
  const rejectionReason = updates.rejectionReason === undefined
    ? existing.rejectionReason ?? null
    : updates.rejectionReason;

  database.prepare(`
    UPDATE publish_queue
    SET status = ?, result_json = ?, approved_by = ?, approved_at = ?, rejection_reason = ?, updated_at = ?
    WHERE id = ?
  `).run(
    nextStatus,
    nextResult ? JSON.stringify(nextResult) : null,
    approvedBy,
    approvedAt,
    rejectionReason,
    now,
    id,
  );

  return getQueueItem(id);
}

export function __resetPublishStoreForTests(): void {
  if (db) {
    db.close();
    db = null;
  }
  dbPath = '';
  dataRoot = resolve(process.env.SINT_DATA_DIR ?? './data');
}
