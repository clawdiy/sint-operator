import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import Database from 'better-sqlite3';
import { getJwtSecret, initAuthDB } from './auth-service.js';
import type { LinkedInCredentials, SocialCredentials, SocialPlatform, TwitterCredentials } from '../services/social/types.js';

type SocialAccountRow = {
  userId: string;
  platform: SocialPlatform;
  encryptedPayload: string;
  iv: string;
  updatedAt: string;
};

type PersistedPayload = TwitterCredentials | LinkedInCredentials;

const PBKDF2_ITERATIONS = 120_000;
const PBKDF2_KEY_LEN = 32;
const PBKDF2_SALT = 'sint-social-account-encryption-v1';

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
    initSocialAccountDB(dataRoot);
  }
  if (!db) {
    throw new Error('Social account DB not initialized');
  }
  return db;
}

function getEncryptionKey(): Buffer {
  initAuthDB(dataRoot);
  const secret = getJwtSecret();
  return pbkdf2Sync(secret, PBKDF2_SALT, PBKDF2_ITERATIONS, PBKDF2_KEY_LEN, 'sha256');
}

function encrypt(payload: PersistedPayload): { encryptedPayload: string; iv: string } {
  const iv = randomBytes(12);
  const key = getEncryptionKey();
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = JSON.stringify(payload);
  const encrypted = Buffer.concat([
    cipher.update(body, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedPayload: `${encrypted.toString('hex')}:${authTag.toString('hex')}`,
    iv: iv.toString('hex'),
  };
}

function decrypt<T extends PersistedPayload>(row: SocialAccountRow): T | null {
  const [cipherHex, authTagHex] = row.encryptedPayload.split(':');
  if (!cipherHex || !authTagHex) return null;

  try {
    const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(row.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherHex, 'hex')),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString('utf8')) as T;
  } catch {
    return null;
  }
}

function isTwitterCredentials(value: unknown): value is TwitterCredentials {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.apiKey === 'string'
    && typeof record.apiSecret === 'string'
    && typeof record.accessToken === 'string'
    && typeof record.accessSecret === 'string';
}

function isLinkedInCredentials(value: unknown): value is LinkedInCredentials {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.accessToken === 'string'
    && typeof record.personUrn === 'string';
}

export function initSocialAccountDB(dataDir: string): void {
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
    CREATE TABLE IF NOT EXISTS social_accounts (
      userId TEXT NOT NULL,
      platform TEXT NOT NULL,
      encryptedPayload TEXT NOT NULL,
      iv TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      PRIMARY KEY (userId, platform)
    );

    CREATE INDEX IF NOT EXISTS idx_social_accounts_userId ON social_accounts(userId);
  `);

  db = database;
  dbPath = targetDbPath;
  dataRoot = resolved;
}

export function storeSocialCredentials(userId: string, platform: SocialPlatform, payload: PersistedPayload): void {
  const database = ensureDb();
  const encrypted = encrypt(payload);
  const now = new Date().toISOString();
  database.prepare(`
    INSERT INTO social_accounts (userId, platform, encryptedPayload, iv, updatedAt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(userId, platform)
    DO UPDATE SET encryptedPayload = excluded.encryptedPayload, iv = excluded.iv, updatedAt = excluded.updatedAt
  `).run(userId, platform, encrypted.encryptedPayload, encrypted.iv, now);
}

export function getSocialCredentialsForPlatform(userId: string, platform: SocialPlatform): PersistedPayload | null {
  const database = ensureDb();
  const row = database.prepare(
    'SELECT userId, platform, encryptedPayload, iv, updatedAt FROM social_accounts WHERE userId = ? AND platform = ?'
  ).get(userId, platform) as SocialAccountRow | undefined;

  if (!row) return null;
  const payload = decrypt<PersistedPayload>(row);
  if (!payload) return null;
  if (platform === 'twitter' && !isTwitterCredentials(payload)) return null;
  if (platform === 'linkedin' && !isLinkedInCredentials(payload)) return null;
  return payload;
}

export function getSocialCredentials(userId: string): SocialCredentials {
  const twitter = getSocialCredentialsForPlatform(userId, 'twitter');
  const linkedin = getSocialCredentialsForPlatform(userId, 'linkedin');
  const credentials: SocialCredentials = {};
  if (twitter && isTwitterCredentials(twitter)) credentials.twitter = twitter;
  if (linkedin && isLinkedInCredentials(linkedin)) credentials.linkedin = linkedin;
  return credentials;
}

export function getSocialStatus(userId: string): {
  twitter: { configured: boolean; handle?: string };
  linkedin: { configured: boolean; personUrn?: string };
} {
  const credentials = getSocialCredentials(userId);

  return {
    twitter: {
      configured: !!(
        credentials.twitter?.apiKey
        && credentials.twitter?.apiSecret
        && credentials.twitter?.accessToken
        && credentials.twitter?.accessSecret
      ),
      handle: credentials.twitter?.handle,
    },
    linkedin: {
      configured: !!(credentials.linkedin?.accessToken && credentials.linkedin?.personUrn),
      personUrn: credentials.linkedin?.personUrn,
    },
  };
}

export function __resetSocialAccountServiceForTests(): void {
  if (db) {
    db.close();
    db = null;
  }
  dbPath = '';
  dataRoot = resolve(process.env.SINT_DATA_DIR ?? './data');
}
