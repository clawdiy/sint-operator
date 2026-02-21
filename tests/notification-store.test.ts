import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NotificationStore } from '../src/core/storage/notification-store.js';

const TEST_ROOT = join(import.meta.dirname ?? '.', '__notification_store_test_tmp__');

describe('NotificationStore', () => {
  let store: NotificationStore;

  beforeEach(() => {
    rmSync(TEST_ROOT, { recursive: true, force: true });
    mkdirSync(TEST_ROOT, { recursive: true });
    store = new NotificationStore(join(TEST_ROOT, 'notifications.db'));
  });

  afterEach(() => {
    store.close();
    rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it('persists notifications and filters by unread', () => {
    store.save({
      id: 'n1',
      userId: 'user-a',
      type: 'info',
      title: 'Info',
      message: 'Message one',
      read: false,
      createdAt: new Date().toISOString(),
    });
    store.save({
      id: 'n2',
      userId: 'user-a',
      type: 'warning',
      title: 'Warn',
      message: 'Message two',
      read: true,
      createdAt: new Date().toISOString(),
    });

    const all = store.list({ userId: 'user-a' });
    expect(all).toHaveLength(2);

    const unread = store.list({ userId: 'user-a', unreadOnly: true });
    expect(unread).toHaveLength(1);
    expect(unread[0].id).toBe('n1');
  });

  it('marks notifications read and trims old rows', () => {
    for (let i = 0; i < 5; i++) {
      store.save({
        id: `n-${i}`,
        userId: 'user-a',
        type: 'info',
        title: 'Msg',
        message: `Message ${i}`,
        read: false,
        createdAt: new Date(Date.now() + i).toISOString(),
      });
    }

    store.markRead('user-a', 'n-1');
    const unread = store.list({ userId: 'user-a', unreadOnly: true });
    expect(unread.some(item => item.id === 'n-1')).toBe(false);

    store.trimUserNotifications('user-a', 2);
    const remaining = store.list({ userId: 'user-a', limit: 10 });
    expect(remaining).toHaveLength(2);

    store.markAllRead('user-a');
    const unreadAfterAll = store.list({ userId: 'user-a', unreadOnly: true });
    expect(unreadAfterAll).toHaveLength(0);
  });
});
