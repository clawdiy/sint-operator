import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import Database from 'better-sqlite3';
import { getJwtSecret, initAuthDB } from './auth-service.js';

type ApiKeyRow = {
  userId: string;
  encryptedKey: string;
  iv: string;
  createdAt: string;
};

const PBKDF2_ITERATIONS = 120_000;
const PBKDF2_KEY_LEN = 32;
const PBKDF2_SALT = 'sint-api-key-encryption-v1';

let db: Database.Database | null = null;
let dbPath = '';
let dataRoot = resolve(process.env.SINT_DATA_DIR ?? './data');

function ensureDataDir(dataDir: string): void {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
}

function ensureDb(): Database.Database {
  if (!db) {
    initApiKeyDB(dataRoot);
  }
  if (!db) {
    throw new Error('API key DB not initialized');
  }
  return db;
}

function getEncryptionKey(): Buffer {
  initAuthDB(dataRoot);
  const secret = getJwtSecret();
  return pbkdf2Sync(secret, PBKDF2_SALT, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, 'sha256');
}

function encrypt(apiKey: string): { encryptedKey: string; iv: string } {
  const iv = randomBytes(12);
  const key = getEncryptionKey();
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(apiKey, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedKey: `${encrypted.toString('hex')}:${authTag.toString('hex')}`,
    iv: iv.toString('hex'),
  };
}

function decrypt(row: ApiKeyRow): string | null {
  const [cipherHex, authTagHex] = row.encryptedKey.split(':');
  if (!cipherHex || !authTagHex) return null;

  try {
    const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(row.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export function initApiKeyDB(dataDir: string): void {
  const resolved = resolve(dataDir);
  const targetDbPath = join(resolved, 'auth.db');

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

  database.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      userId TEXT PRIMARY KEY,
      encryptedKey TEXT NOT NULL,
      iv TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  db = database;
  dbPath = targetDbPath;
  dataRoot = resolved;
}

export function storeApiKey(userId: string, apiKey: string): void {
  const database = ensureDb();
  const encrypted = encrypt(apiKey);
  const now = new Date().toISOString();

  database.prepare(`
    INSERT INTO api_keys (userId, encryptedKey, iv, createdAt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(userId)
    DO UPDATE SET encryptedKey = excluded.encryptedKey, iv = excluded.iv, createdAt = excluded.createdAt
  `).run(userId, encrypted.encryptedKey, encrypted.iv, now);
}

export function getApiKey(userId: string): string | null {
  const database = ensureDb();
  const row = database.prepare(
    'SELECT userId, encryptedKey, iv, createdAt FROM api_keys WHERE userId = ?'
  ).get(userId) as ApiKeyRow | undefined;

  if (!row) return null;
  return decrypt(row);
}

export function deleteApiKey(userId: string): void {
  const database = ensureDb();
  database.prepare('DELETE FROM api_keys WHERE userId = ?').run(userId);
}

export function hasApiKey(userId: string): boolean {
  const database = ensureDb();
  const row = database.prepare('SELECT 1 as found FROM api_keys WHERE userId = ?').get(userId) as { found: number } | undefined;
  return !!row;
}

export function __resetApiKeyServiceForTests(): void {
  if (db) {
    db.close();
    db = null;
  }
  dbPath = '';
  dataRoot = resolve(process.env.SINT_DATA_DIR ?? './data');
}
