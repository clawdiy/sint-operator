import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import {
  __resetAuthForTests,
  getUser,
  initAuthDB,
  login,
  signup,
  verifyToken,
} from '../src/auth/auth-service.js';

const TEST_ROOT = join(import.meta.dirname ?? '.', '__auth_test_tmp__');

function ensureCleanDir(): void {
  if (existsSync(TEST_ROOT)) {
    rmSync(TEST_ROOT, { recursive: true, force: true });
  }
  mkdirSync(TEST_ROOT, { recursive: true });
}

describe('auth-service', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    ensureCleanDir();
    initAuthDB(TEST_ROOT);
  });

  afterEach(() => {
    __resetAuthForTests();
    if (existsSync(TEST_ROOT)) {
      rmSync(TEST_ROOT, { recursive: true, force: true });
    }
    delete process.env.JWT_SECRET;
  });

  it('signs up user and returns token + safe user', () => {
    const result = signup('alice@example.com', 'password123', 'Alice');

    expect(result.user.id).toBeDefined();
    expect(result.user.email).toBe('alice@example.com');
    expect(result.user.name).toBe('Alice');
    expect(result.token.split('.').length).toBe(3);
  });

  it('logs in with valid credentials and verifies token payload', () => {
    const created = signup('bob@example.com', 'password123', 'Bob');
    const loggedIn = login('bob@example.com', 'password123');

    const payload = verifyToken(loggedIn.token);
    expect(payload.userId).toBe(created.user.id);
    expect(payload.email).toBe('bob@example.com');

    const user = getUser(payload.userId);
    expect(user?.email).toBe('bob@example.com');
    expect(user?.name).toBe('Bob');
  });

  it('rejects invalid login credentials', () => {
    signup('carol@example.com', 'password123', 'Carol');

    expect(() => login('carol@example.com', 'wrong-password')).toThrow('Invalid email or password');
  });
});
