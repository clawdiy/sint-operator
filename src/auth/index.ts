/**
 * JWT Authentication System
 * - User registration and login
 * - Password hashing with bcrypt
 * - JWT token generation and validation
 * - SQLite user store
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import { randomBytes } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// ─── JWT Secret ───────────────────────────────────────────────

let JWT_SECRET = process.env.SINT_JWT_SECRET ?? '';
if (!JWT_SECRET) {
  JWT_SECRET = randomBytes(64).toString('hex');
  console.warn('⚠️  SINT_JWT_SECRET not set — using random secret. Tokens will invalidate on restart.');
}

const TOKEN_EXPIRY = '24h';
const BCRYPT_ROUNDS = 10;

// ─── Types ────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  role: string;
  api_key_encrypted: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload & { apiKey?: string | null };
}

// ─── UserStore ────────────────────────────────────────────────

export class UserStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'user',
        api_key_encrypted TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  createUser(email: string, passwordHash: string, name?: string, role: 'admin' | 'user' = 'user'): UserRow {
    const now = new Date().toISOString();
    const id = nanoid(12);
    this.db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, email, passwordHash, name ?? null, role, now, now);
    return this.getById(id)!;
  }

  getById(id: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  }

  getByEmail(email: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
  }

  updateUser(id: string, updates: { name?: string; api_key_encrypted?: string | null }): UserRow | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;
    const now = new Date().toISOString();
    const name = updates.name !== undefined ? updates.name : existing.name;
    const apiKey = updates.api_key_encrypted !== undefined ? updates.api_key_encrypted : existing.api_key_encrypted;
    this.db.prepare(`
      UPDATE users SET name = ?, api_key_encrypted = ?, updated_at = ? WHERE id = ?
    `).run(name, apiKey, now, id);
    return this.getById(id);
  }

  countUsers(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    return row.count;
  }

  close(): void {
    this.db.close();
  }
}

// ─── Password Helpers ─────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Token Helpers ────────────────────────────────────────────

export function generateToken(userId: string, email: string, role: string): string {
  return jwt.sign({ userId, email, role } satisfies TokenPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

// ─── Sanitize User for API response ──────────────────────────

export function sanitizeUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role as 'admin' | 'user',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ─── Auth Middleware ──────────────────────────────────────────

let _userStore: UserStore | null = null;

export function setUserStore(store: UserStore): void {
  _userStore = store;
}

export function getUserStore(): UserStore {
  if (!_userStore) throw new Error('UserStore not initialized');
  return _userStore;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required (Bearer token)' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    const store = getUserStore();
    const userRow = store.getById(payload.userId);
    if (!userRow) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    (req as AuthenticatedRequest).user = {
      ...payload,
      apiKey: userRow.api_key_encrypted ?? null,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user || authReq.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
