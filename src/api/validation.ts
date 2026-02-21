import type { Request, Response, NextFunction } from 'express';

export function validateBody(schema: Record<string, { type: string; required?: boolean; maxLength?: number }>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body must be JSON' });
    }
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = body[field];
      
      if (rules.required && (value === undefined || value === null || value === '')) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
      
      if (value !== undefined && value !== null) {
        if (rules.type === 'string' && typeof value !== 'string') {
          return res.status(400).json({ error: `${field} must be a string` });
        }
        if (rules.type === 'number' && typeof value !== 'number') {
          return res.status(400).json({ error: `${field} must be a number` });
        }
        if (rules.type === 'array' && !Array.isArray(value)) {
          return res.status(400).json({ error: `${field} must be an array` });
        }
        if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
          return res.status(400).json({ error: `${field} exceeds max length of ${rules.maxLength}` });
        }
      }
    }
    
    next();
  };
}
