/**
 * OAuth2 API Routes
 * 
 * GET  /api/oauth/:provider/authorize — Redirect to OAuth provider
 * GET  /api/oauth/:provider/callback  — Handle OAuth callback
 * GET  /api/oauth/status              — List connected accounts
 * DELETE /api/oauth/:provider         — Disconnect account
 */

import { Router, type Request, type Response } from 'express';
import { OAuthManager, type OAuthProvider } from '../integrations/oauth-manager.js';

const VALID_PROVIDERS: OAuthProvider[] = ['google', 'facebook', 'linkedin', 'twitter', 'shopify'];

export function createOAuthRoutes(config: { baseUrl: string; dbPath?: string }): Router {
  const router = Router();
  const oauth = new OAuthManager(config.dbPath);

  // GET /api/oauth/:provider/authorize
  router.get('/:provider/authorize', (req: Request, res: Response) => {
    const provider = req.params.provider as OAuthProvider;
    if (!VALID_PROVIDERS.includes(provider)) {
      res.status(400).json({ error: `Invalid provider: ${provider}` });
      return;
    }

    try {
      const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url');
      const url = oauth.getAuthorizeUrl(provider, config.baseUrl, state);
      res.redirect(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate authorize URL';
      res.status(500).json({ error: message });
    }
  });

  // GET /api/oauth/:provider/callback
  router.get('/:provider/callback', async (req: Request, res: Response) => {
    const provider = req.params.provider as OAuthProvider;
    const { code, error } = req.query;

    if (error) {
      res.status(400).json({ error: `OAuth denied: ${error}` });
      return;
    }

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Missing authorization code' });
      return;
    }

    try {
      const token = await oauth.exchangeCode(provider, code, config.baseUrl);
      res.json({
        success: true,
        message: `Connected to ${provider}`,
        provider,
        accountId: token.accountId,
        scope: token.scope,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token exchange failed';
      res.status(500).json({ error: message });
    }
  });

  // GET /api/oauth/status
  router.get('/status', (_req: Request, res: Response) => {
    const accounts = oauth.getConnectedAccounts();
    res.json({
      success: true,
      accounts,
      providers: VALID_PROVIDERS,
    });
  });

  // DELETE /api/oauth/:provider
  router.delete('/:provider', (req: Request, res: Response) => {
    const provider = req.params.provider as OAuthProvider;
    const accountId = (req.query.accountId as string) ?? '';
    oauth.removeToken(provider, accountId);
    res.json({ success: true, message: `Disconnected ${provider}` });
  });

  return router;
}
