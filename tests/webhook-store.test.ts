import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebhookStore } from '../src/core/storage/webhook-store.js';

const TEST_ROOT = join(import.meta.dirname ?? '.', '__webhook_store_test_tmp__');

describe('WebhookStore', () => {
  let store: WebhookStore;

  beforeEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    mkdirSync(TEST_ROOT, { recursive: true });
    store = new WebhookStore(join(TEST_ROOT, 'webhooks.db'));
  });

  afterEach(() => {
    store.close();
    rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it('persists and lists webhook events by user', () => {
    store.save({
      id: 'evt-1',
      userId: 'user-a',
      source: 'zapier',
      event: 'pipeline.completed',
      data: { ok: true },
      receivedAt: new Date().toISOString(),
    });
    store.save({
      id: 'evt-2',
      userId: 'user-b',
      source: 'n8n',
      event: 'pipeline.failed',
      receivedAt: new Date().toISOString(),
    });

    const userA = store.list({ userId: 'user-a' });
    expect(userA).toHaveLength(1);
    expect(userA[0].id).toBe('evt-1');
    expect(userA[0].source).toBe('zapier');
  });

  it('filters by source/event and trims old entries', () => {
    for (let i = 0; i < 5; i++) {
      store.save({
        id: `evt-${i}`,
        userId: 'user-a',
        source: i % 2 === 0 ? 'zapier' : 'n8n',
        event: i % 2 === 0 ? 'pipeline.completed' : 'pipeline.failed',
        receivedAt: new Date(Date.now() + i).toISOString(),
      });
    }

    const zapier = store.list({ userId: 'user-a', source: 'zapier' });
    expect(zapier.every(item => item.source === 'zapier')).toBe(true);

    store.trimUserEvents('user-a', 2);
    expect(store.countByUser('user-a')).toBe(2);
  });
});
