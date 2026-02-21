import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { __resetAuthForTests, initAuthDB, signup } from '../src/auth/auth-service.js';
import { getPublishWorkerIntervalMs, getRateLimitKey, isValidWebhookSharedSecret, rewriteVersionedPath, shouldBypassApiAuth } from '../src/api/server.js';

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

  it('bypasses API auth for public routes and webhook POST only', () => {
    expect(shouldBypassApiAuth('/test-llm', true)).toBe(true);
    expect(shouldBypassApiAuth('/auth/login', true)).toBe(true);
    expect(shouldBypassApiAuth('/webhooks', true, 'POST')).toBe(true);
    expect(shouldBypassApiAuth('/webhooks', true, 'GET')).toBe(false);
  });

  it('does not bypass API auth for publish routes when auth is enabled', () => {
    expect(shouldBypassApiAuth('/publish', true)).toBe(false);
    expect(shouldBypassApiAuth('/publish/status', true)).toBe(false);
  });

  it('bypasses all API auth checks when auth is disabled', () => {
    expect(shouldBypassApiAuth('/publish', false)).toBe(true);
    expect(shouldBypassApiAuth('/runs', false)).toBe(true);
  });

  it('normalizes publish worker interval bounds', () => {
    expect(getPublishWorkerIntervalMs(undefined)).toBe(30_000);
    expect(getPublishWorkerIntervalMs('100')).toBe(5_000);
    expect(getPublishWorkerIntervalMs('9999999')).toBe(300_000);
    expect(getPublishWorkerIntervalMs('45000')).toBe(45_000);
  });

  it('validates webhook shared secret correctly', () => {
    expect(isValidWebhookSharedSecret('top-secret', 'top-secret')).toBe(true);
    expect(isValidWebhookSharedSecret(' top-secret ', 'top-secret')).toBe(true);
    expect(isValidWebhookSharedSecret('top-secret', 'bad-secret')).toBe(false);
    expect(isValidWebhookSharedSecret(undefined, 'top-secret')).toBe(false);
    expect(isValidWebhookSharedSecret('top-secret', undefined)).toBe(false);
  });
});
