import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { __resetAuthForTests, initAuthDB } from '../src/auth/auth-service.js';
import {
  __resetApiKeyServiceForTests,
  deleteApiKey,
  getApiKey,
  hasApiKey,
  initApiKeyDB,
  storeApiKey,
} from '../src/auth/api-key-service.js';

const TEST_ROOT = join(import.meta.dirname ?? '.', '__api_key_test_tmp__');

describe('api-key-service', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'api-key-test-secret';
    if (existsSync(TEST_ROOT)) {
      rmSync(TEST_ROOT, { recursive: true, force: true });
    }
    mkdirSync(TEST_ROOT, { recursive: true });

    initAuthDB(TEST_ROOT);
    initApiKeyDB(TEST_ROOT);
  });

  afterEach(() => {
    __resetApiKeyServiceForTests();
    __resetAuthForTests();
    if (existsSync(TEST_ROOT)) {
      rmSync(TEST_ROOT, { recursive: true, force: true });
    }
    delete process.env.JWT_SECRET;
  });

  it('stores and returns decrypted API key by user', () => {
    storeApiKey('user-1', 'sk-test-1234567890');

    expect(hasApiKey('user-1')).toBe(true);
    expect(getApiKey('user-1')).toBe('sk-test-1234567890');
  });

  it('deletes API key for user', () => {
    storeApiKey('user-2', 'sk-test-abcdef');
    expect(hasApiKey('user-2')).toBe(true);

    deleteApiKey('user-2');

    expect(hasApiKey('user-2')).toBe(false);
    expect(getApiKey('user-2')).toBeNull();
  });
});
