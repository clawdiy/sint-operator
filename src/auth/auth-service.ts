import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export type SafeUser = { id: string; email: string; name: string; createdAt: string };

type TokenPayload = {
  userId: string;
  email: string;
  sub: string;
  iat: number;
  exp: number;
};

type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

const signupSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

const userIdSchema = z.string().trim().min(1);

const PASSWORD_ITERATIONS = 310_000;
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

let authDb: Database.Database | null = null;
let authDbPath = '';
let authDataDir = resolve(process.env.SINT_DATA_DIR ?? './data');
let cachedJwtSecret = '';

function base64UrlEncode(input: Buffer | string): string {
  const encoded = Buffer.isBuffer(input) ? input.toString('base64') : Buffer.from(input).toString('base64');
  return encoded.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4;
  const withPadding = padding === 0 ? normalized : `${normalized}${'='.repeat(4 - padding)}`;
  return Buffer.from(withPadding, 'base64');
}

function ensureDataDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toSafeUser(row: UserRow): SafeUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt,
  };
}

function ensureDb(): Database.Database {
  if (!authDb) {
    initAuthDB(authDataDir);
  }
  if (!authDb) {
    throw new Error('Auth DB not initialized');
  }
  return authDb;
}

function readOrCreateJwtSecret(dataDir: string): string {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret) {
    return envSecret;
  }

  const secretPath = join(dataDir, 'jwt-secret');
  if (existsSync(secretPath)) {
    const existing = readFileSync(secretPath, 'utf8').trim();
    if (existing) {
      return existing;
    }
  }

  const generated = randomBytes(32).toString('hex');
  writeFileSync(secretPath, generated, { mode: 0o600 });
  return generated;
}

function ensureJwtSecret(): string {
  if (cachedJwtSecret) {
    return cachedJwtSecret;
  }

  initAuthDB(authDataDir);
  if (!cachedJwtSecret) {
    throw new Error('JWT secret not initialized');
  }
  return cachedJwtSecret;
}

function signToken(payload: Omit<TokenPayload, 'iat' | 'exp' | 'sub'>): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TokenPayload = {
    ...payload,
    sub: payload.userId,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', ensureJwtSecret()).update(signingInput).digest();

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

function verifySignature(headerPayload: string, signature: string): boolean {
  const expected = createHmac('sha256', ensureJwtSecret()).update(headerPayload).digest();
  const provided = base64UrlDecode(signature);

  if (expected.length !== provided.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, 'sha256').toString('hex');
  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

function comparePassword(password: string, stored: string): boolean {
  const [scheme, iterationsRaw, salt, storedHash] = stored.split('$');
  if (scheme !== 'pbkdf2' || !iterationsRaw || !salt || !storedHash) {
    return false;
  }

  const iterations = Number.parseInt(iterationsRaw, 10);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }

  const candidateHash = pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

function initTables(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);
}

export function initAuthDB(dataDir: string): void {
  const resolvedDataDir = resolve(dataDir);
  const targetDbPath = join(resolvedDataDir, 'auth.db');

  if (authDb && authDbPath === targetDbPath) {
    return;
  }

  if (authDb) {
    authDb.close();
    authDb = null;
  }

  ensureDataDir(resolvedDataDir);
  const database = new Database(targetDbPath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  initTables(database);

  authDb = database;
  authDbPath = targetDbPath;
  authDataDir = resolvedDataDir;
  cachedJwtSecret = readOrCreateJwtSecret(resolvedDataDir);
}

export function signup(email: string, password: string, name: string): { user: SafeUser; token: string } {
  const parsed = signupSchema.parse({
    email: normalizeEmail(email),
    password,
    name,
  });

  const database = ensureDb();
  const existing = database.prepare('SELECT id FROM users WHERE email = ?').get(parsed.email) as { id: string } | undefined;
  if (existing) {
    throw new Error('Email already registered');
  }

  const now = new Date().toISOString();
  const user: SafeUser = {
    id: nanoid(12),
    email: parsed.email,
    name: parsed.name,
    createdAt: now,
  };

  database.prepare(`
    INSERT INTO users (id, email, passwordHash, name, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(user.id, user.email, hashPassword(parsed.password), user.name, now, now);

  return {
    user,
    token: signToken({ userId: user.id, email: user.email }),
  };
}

export function login(email: string, password: string): { user: SafeUser; token: string } {
  const parsed = loginSchema.parse({
    email: normalizeEmail(email),
    password,
  });

  const database = ensureDb();
  const row = database.prepare('SELECT * FROM users WHERE email = ?').get(parsed.email) as UserRow | undefined;

  if (!row || !comparePassword(parsed.password, row.passwordHash)) {
    throw new Error('Invalid email or password');
  }

  const user = toSafeUser(row);
  return {
    user,
    token: signToken({ userId: user.id, email: user.email }),
  };
}

export function verifyToken(token: string): { userId: string; email: string } {
  const [headerPart, payloadPart, signaturePart] = token.trim().split('.');
  if (!headerPart || !payloadPart || !signaturePart) {
    throw new Error('Invalid token');
  }

  const headerPayload = `${headerPart}.${payloadPart}`;
  if (!verifySignature(headerPayload, signaturePart)) {
    throw new Error('Invalid token signature');
  }

  const payload = JSON.parse(base64UrlDecode(payloadPart).toString('utf8')) as Partial<TokenPayload>;
  if (!payload.userId || !payload.email || typeof payload.exp !== 'number') {
    throw new Error('Invalid token payload');
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return {
    userId: payload.userId,
    email: payload.email,
  };
}

export function getUser(userId: string): SafeUser | null {
  const parsedUserId = userIdSchema.parse(userId);
  const database = ensureDb();
  const row = database.prepare('SELECT * FROM users WHERE id = ?').get(parsedUserId) as UserRow | undefined;
  return row ? toSafeUser(row) : null;
}

export function getJwtSecret(): string {
  return ensureJwtSecret();
}

export function __resetAuthForTests(): void {
  if (authDb) {
    authDb.close();
    authDb = null;
  }
  authDbPath = '';
  cachedJwtSecret = '';
  authDataDir = resolve(process.env.SINT_DATA_DIR ?? './data');
}
