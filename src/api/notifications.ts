import { EventEmitter } from 'events';
import { Router, type Response } from 'express';
import { nanoid } from 'nanoid';
import type { AuthenticatedRequest } from '../auth/auth-middleware.js';

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

const notificationStore = new Map<string, Notification[]>();
const streamsByUser = new Map<string, Set<Response>>();
const notificationEvents = new EventEmitter();
notificationEvents.setMaxListeners(200);

function getBucket(userId: string): Notification[] {
  const existing = notificationStore.get(userId);
  if (existing) return existing;
  const created: Notification[] = [];
  notificationStore.set(userId, created);
  return created;
}

function getUserId(req: AuthenticatedRequest): string | null {
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

  const bucket = getBucket(userId);
  bucket.push(item);

  while (bucket.length > MAX_NOTIFICATIONS_PER_USER) {
    bucket.shift();
  }

  notificationEvents.emit(`notification:${userId}`, item);
  emitToStreams(userId, item);
}

export function getNotifications(userId: string, unreadOnly: boolean = false): Notification[] {
  const bucket = getBucket(userId);
  const filtered = unreadOnly ? bucket.filter(n => !n.read) : bucket;
  return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function markRead(userId: string, notificationId: string): void {
  const bucket = getBucket(userId);
  const item = bucket.find(n => n.id === notificationId);
  if (item) {
    item.read = true;
  }
}

export function markAllRead(userId: string): void {
  const bucket = getBucket(userId);
  bucket.forEach(item => {
    item.read = true;
  });
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
