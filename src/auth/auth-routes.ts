import { Router } from 'express';
import { ZodError, z } from 'zod';
import { getUser, login, signup } from './auth-service.js';
import { requireAuth, type AuthenticatedRequest } from './auth-middleware.js';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function createAuthRouter(): Router {
  const router = Router();

  router.post('/signup', (req, res) => {
    try {
      const payload = signupSchema.parse(req.body ?? {});
      const result = signup(payload.email, payload.password, payload.name);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: error.issues[0]?.message ?? 'Invalid payload' });
        return;
      }

      const message = toMessage(error, 'Unknown error');
      if (message.toLowerCase().includes('already')) {
        res.status(409).json({ error: message });
        return;
      }

      res.status(500).json({ error: message });
    }
  });

  router.post('/login', (req, res) => {
    try {
      const payload = loginSchema.parse(req.body ?? {});
      const result = login(payload.email, payload.password);
      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: error.issues[0]?.message ?? 'Invalid payload' });
        return;
      }

      const message = toMessage(error, 'Unknown error');
      if (message.toLowerCase().includes('invalid email or password')) {
        res.status(401).json({ error: message });
        return;
      }

      res.status(500).json({ error: message });
    }
  });

  router.get('/me', requireAuth, (req, res) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = getUser(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  });

  return router;
}
