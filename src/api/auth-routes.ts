/**
 * Auth API Routes
 * 
 * POST /api/auth/register  — Register new user (first user = admin)
 * POST /api/auth/login     — Login with email/password
 * GET  /api/auth/me        — Get current user profile
 * PUT  /api/auth/me        — Update current user profile
 * POST /api/auth/api-key   — Set user's LLM API key
 */

import { Router } from 'express';
import {
  getUserStore,
  hashPassword,
  verifyPassword,
  generateToken,
  sanitizeUser,
  authMiddleware,
  type AuthenticatedRequest,
} from '../auth/index.js';

export function createAuthRouter(): Router {
  const router = Router();

  // ─── Register ───────────────────────────────────────────

  router.post('/register', async (req, res) => {
    try {
      const { email, password, name } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'email and password required' });
      }

      if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'email and password must be strings' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      const store = getUserStore();

      // Check if email already taken
      const existing = store.getByEmail(email.toLowerCase().trim());
      if (existing) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // First user becomes admin
      const isFirstUser = store.countUsers() === 0;
      const role = isFirstUser ? 'admin' : 'user';

      const passwordHash = await hashPassword(password);
      const userRow = store.createUser(
        email.toLowerCase().trim(),
        passwordHash,
        name,
        role,
      );

      const token = generateToken(userRow.id, userRow.email, userRow.role);
      const user = sanitizeUser(userRow);

      res.status(201).json({ token, user });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Registration failed' });
    }
  });

  // ─── Login ──────────────────────────────────────────────

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'email and password required' });
      }

      const store = getUserStore();
      const userRow = store.getByEmail(email.toLowerCase().trim());

      if (!userRow) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const valid = await verifyPassword(password, userRow.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = generateToken(userRow.id, userRow.email, userRow.role);
      const user = sanitizeUser(userRow);

      res.json({ token, user });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Login failed' });
    }
  });

  // ─── Get Current User ──────────────────────────────────

  router.get('/me', authMiddleware, (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const store = getUserStore();
      const userRow = store.getById(authReq.user!.userId);

      if (!userRow) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = sanitizeUser(userRow);
      res.json({ user, hasApiKey: !!userRow.api_key_encrypted });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to get user' });
    }
  });

  // ─── Update Current User ───────────────────────────────

  router.put('/me', authMiddleware, (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { name } = req.body;
      const store = getUserStore();

      const updated = store.updateUser(authReq.user!.userId, {
        ...(name !== undefined ? { name } : {}),
      });

      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user: sanitizeUser(updated) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Update failed' });
    }
  });

  // ─── Set API Key ────────────────────────────────────────

  router.post('/api-key', authMiddleware, (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const { apiKey } = req.body;

      if (apiKey !== undefined && apiKey !== null && typeof apiKey !== 'string') {
        return res.status(400).json({ error: 'apiKey must be a string or null' });
      }

      const store = getUserStore();
      const updated = store.updateUser(authReq.user!.userId, {
        api_key_encrypted: apiKey ?? null,
      });

      if (!updated) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ status: 'ok', hasApiKey: !!updated.api_key_encrypted });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to set API key' });
    }
  });

  return router;
}
