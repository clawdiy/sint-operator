import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { __resetAuthForTests, initAuthDB, signup } from '../src/auth/auth-service.js';
import { getRateLimitKey, rewriteVersionedPath } from '../src/api/server.js';

const TEST_ROOT = join(import.meta.dirname ?? '.', '__server_test_tmp__');

describe('server routing and rate-limit helpers', () => {
  beforeAll(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    mkdirSync(TEST_ROOT, { recursive: true });
    initAuthDB(TEST_ROOT);
  });

  afterAll(() => {
    __resetAuthForTests();
    rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it('rewrites /v1/api routes to /api', () => {
    expect(rewriteVersionedPath('/v1/api/pipelines')).toBe('/api/pipelines');
    expect(rewriteVersionedPath('/v1/api?limit=10')).toBe('/api?limit=10');
    expect(rewriteVersionedPath('/api/pipelines')).toBe('/api/pipelines');
  });

  it('rewrites /v1/health to /health', () => {
    expect(rewriteVersionedPath('/v1/health')).toBe('/health');
    expect(rewriteVersionedPath('/v1/health?full=true')).toBe('/health?full=true');
    expect(rewriteVersionedPath('/health')).toBe('/health');
  });

  it('uses user id as rate-limit key when bearer token is present', () => {
    const { user, token } = signup('rl-bearer@example.com', 'strongpass123', 'Rate Limit Bearer');
    const req = {
      ip: '203.0.113.8',
      query: {},
      header: (name: string) => (name === 'Authorization' ? `Bearer ${token}` : undefined),
    } as any;

    expect(getRateLimitKey(req)).toBe(`user:${user.id}`);
  });

  it('uses user id as rate-limit key when token is in query string', () => {
    const { user, token } = signup('rl-query@example.com', 'strongpass123', 'Rate Limit Query');
    const req = {
      ip: '203.0.113.9',
      query: { token },
      header: () => undefined,
    } as any;

    expect(getRateLimitKey(req)).toBe(`user:${user.id}`);
  });

  it('falls back to IP rate-limit key when no valid user token exists', () => {
    const req = {
      ip: '203.0.113.7',
      query: {},
      header: () => undefined,
    } as any;

    expect(getRateLimitKey(req)).toBe('ip:203.0.113.7');
  });
});
