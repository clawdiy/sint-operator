import { Router, type Response } from 'express';
import { nanoid } from 'nanoid';
import { join, resolve } from 'path';
import type { AuthenticatedRequest } from '../auth/auth-middleware.js';
import { NotificationStore } from '../core/storage/notification-store.js';

export type NotificationType = 'run_completed' | 'run_failed' | 'info' | 'warning';

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  runId?: string;
  read: boolean;
  createdAt: string;
};

const MAX_NOTIFICATIONS_PER_USER = 100;

const streamsByUser = new Map<string, Set<Response>>();
let notificationStore: NotificationStore | null = null;
let storeDataDir = resolve(process.env.SINT_DATA_DIR ?? './data');
let storePath = '';

function ensureStore(): NotificationStore {
  if (!notificationStore) {
    initNotificationStore(storeDataDir);
  }
  if (!notificationStore) {
    throw new Error('Notification store not initialized');
  }
  return notificationStore;
}

export function initNotificationStore(dataDir: string): void {
  const resolved = resolve(dataDir);
  const targetPath = join(resolved, 'notifications.db');

  if (notificationStore && storePath === targetPath) {
    return;
  }

  if (notificationStore) {
    notificationStore.close();
    notificationStore = null;
  }

  notificationStore = new NotificationStore(targetPath);
  storeDataDir = resolved;
  storePath = targetPath;
}

export function closeNotificationStore(): void {
  if (notificationStore) {
    notificationStore.close();
    notificationStore = null;
  }
  storePath = '';
  storeDataDir = resolve(process.env.SINT_DATA_DIR ?? './data');
}

function getUserId(req: AuthenticatedRequest): string | null {
  // When auth is disabled, use default user
  if (process.env.AUTH_ENABLED !== 'true') return 'default';
  return req.user?.userId ?? null;
}

function pushSse(res: Response, event: string, payload: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function emitToStreams(userId: string, notification: Notification): void {
  const listeners = streamsByUser.get(userId);
  if (!listeners) return;

  listeners.forEach(res => {
    pushSse(res, 'notification', notification);
  });
}

export function addNotification(
  userId: string,
  notification: { type: string; title: string; message: string; runId?: string }
): void {
  const store = ensureStore();
  const item: Notification = {
    id: nanoid(12),
    userId,
    type: (notification.type as NotificationType) ?? 'info',
    title: notification.title,
    message: notification.message,
    runId: notification.runId,
    read: false,
    createdAt: new Date().toISOString(),
  };

  store.save(item);
  store.trimUserNotifications(userId, MAX_NOTIFICATIONS_PER_USER);
  emitToStreams(userId, item);
}

export function getNotifications(userId: string, unreadOnly: boolean = false): Notification[] {
  const store = ensureStore();
  return store.list({
    userId,
    unreadOnly,
    limit: MAX_NOTIFICATIONS_PER_USER,
  }) as Notification[];
}

export function markRead(userId: string, notificationId: string): void {
  ensureStore().markRead(userId, notificationId);
}

export function markAllRead(userId: string): void {
  ensureStore().markAllRead(userId);
}

export function __resetNotificationsForTests(): void {
  closeNotificationStore();
  streamsByUser.clear();
}

export function createNotificationsRouter(): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const userId = getUserId(req as AuthenticatedRequest);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const unreadOnly = String(req.query.unread ?? '').toLowerCase() === 'true';
    res.json(getNotifications(userId, unreadOnly));
  });

  router.post('/:id/read', (req, res) => {
    const userId = getUserId(req as AuthenticatedRequest);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    markRead(userId, req.params.id);
    res.json({ success: true });
  });

  router.post('/read-all', (req, res) => {
    const userId = getUserId(req as AuthenticatedRequest);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    markAllRead(userId);
    res.json({ success: true });
  });

  router.get('/stream', (req, res) => {
    const userId = getUserId(req as AuthenticatedRequest);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const listeners = streamsByUser.get(userId) ?? new Set<Response>();
    listeners.add(res);
    streamsByUser.set(userId, listeners);

    pushSse(res, 'connected', { ok: true });

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      listeners.delete(res);
      if (listeners.size === 0) {
        streamsByUser.delete(userId);
      }
    });
  });

  return router;
}
