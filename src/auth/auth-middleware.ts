import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from './auth-service.js';

export type AuthenticatedRequest = Request & {
  user?: {
    userId: string;
    email: string;
  };
};

function parseBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }
  return token.trim() || null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = parseBearerToken(req.header('Authorization'));
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const payload = verifyToken(token);
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
