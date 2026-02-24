/**
 * OAuth2 Manager
 * 
 * Token storage, refresh, and flow management for external services.
 * Supports: Google, Meta/Facebook, LinkedIn, Twitter, Shopify
 */

import Database from 'better-sqlite3';
import path from 'path';

export type OAuthProvider = 'google' | 'facebook' | 'linkedin' | 'twitter' | 'shopify';

export interface OAuthToken {
  provider: OAuthProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // epoch ms
  scope?: string;
  accountId?: string;
  accountName?: string;
}

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authorizeUrl: string;
  tokenUrl: string;
}

const PROVIDER_CONFIGS: Record<OAuthProvider, Omit<OAuthProviderConfig, 'clientId' | 'clientSecret' | 'redirectUri'>> = {
  google: {
    scopes: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/youtube.upload'],
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
  },
  facebook: {
    scopes: ['pages_manage_posts', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish'],
    authorizeUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
  },
  linkedin: {
    scopes: ['openid', 'profile', 'w_member_social'],
    authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  },
  twitter: {
    scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
    authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
  },
  shopify: {
    scopes: ['read_products', 'write_products', 'read_content', 'write_content'],
    authorizeUrl: '', // Dynamic: https://{shop}.myshopify.com/admin/oauth/authorize
    tokenUrl: '', // Dynamic: https://{shop}.myshopify.com/admin/oauth/access_token
  },
};

export class OAuthManager {
  private db: Database.Database;

  constructor(dbPath?: string) {
    this.db = new Database(dbPath ?? path.join(process.cwd(), 'data', 'oauth.db'));
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        provider TEXT NOT NULL,
        account_id TEXT DEFAULT '',
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at INTEGER,
        scope TEXT,
        account_name TEXT,
        updated_at INTEGER DEFAULT (unixepoch() * 1000),
        PRIMARY KEY (provider, account_id)
      )
    `);
  }

  getAuthorizeUrl(provider: OAuthProvider, baseUrl: string, state?: string): string {
    const envPrefix = provider.toUpperCase();
    const clientId = process.env[`${envPrefix}_CLIENT_ID`];
    if (!clientId) throw new Error(`${envPrefix}_CLIENT_ID not configured`);

    const cfg = PROVIDER_CONFIGS[provider];
    const redirectUri = `${baseUrl}/api/oauth/${provider}/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: cfg.scopes.join(' '),
      access_type: 'offline',
      ...(state ? { state } : {}),
    });

    return `${cfg.authorizeUrl}?${params}`;
  }

  async exchangeCode(provider: OAuthProvider, code: string, baseUrl: string): Promise<OAuthToken> {
    const envPrefix = provider.toUpperCase();
    const clientId = process.env[`${envPrefix}_CLIENT_ID`];
    const clientSecret = process.env[`${envPrefix}_CLIENT_SECRET`];
    if (!clientId || !clientSecret) throw new Error(`${envPrefix} OAuth credentials not configured`);

    const cfg = PROVIDER_CONFIGS[provider];
    const redirectUri = `${baseUrl}/api/oauth/${provider}/callback`;

    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OAuth token exchange failed for ${provider}: ${text}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    const token: OAuthToken = {
      provider,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      scope: data.scope,
    };

    this.saveToken(token);
    return token;
  }

  async refreshToken(provider: OAuthProvider, accountId = ''): Promise<OAuthToken | null> {
    const existing = this.getToken(provider, accountId);
    if (!existing?.refreshToken) return null;

    const envPrefix = provider.toUpperCase();
    const clientId = process.env[`${envPrefix}_CLIENT_ID`];
    const clientSecret = process.env[`${envPrefix}_CLIENT_SECRET`];
    if (!clientId || !clientSecret) return null;

    const cfg = PROVIDER_CONFIGS[provider];

    const res = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: existing.refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const token: OAuthToken = {
      ...existing,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? existing.refreshToken,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : existing.expiresAt,
    };

    this.saveToken(token);
    return token;
  }

  /** Get valid token, auto-refreshing if expired */
  async getValidToken(provider: OAuthProvider, accountId = ''): Promise<OAuthToken | null> {
    const token = this.getToken(provider, accountId);
    if (!token) return null;

    if (token.expiresAt && token.expiresAt < Date.now() + 60_000) {
      return this.refreshToken(provider, accountId);
    }

    return token;
  }

  saveToken(token: OAuthToken): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO oauth_tokens (provider, account_id, access_token, refresh_token, expires_at, scope, account_name, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      token.provider,
      token.accountId ?? '',
      token.accessToken,
      token.refreshToken ?? null,
      token.expiresAt ?? null,
      token.scope ?? null,
      token.accountName ?? null,
      Date.now(),
    );
  }

  getToken(provider: OAuthProvider, accountId = ''): OAuthToken | null {
    const row = this.db.prepare(
      'SELECT * FROM oauth_tokens WHERE provider = ? AND account_id = ?'
    ).get(provider, accountId) as any;

    if (!row) return null;
    return {
      provider: row.provider,
      accessToken: row.access_token,
      refreshToken: row.refresh_token ?? undefined,
      expiresAt: row.expires_at ?? undefined,
      scope: row.scope ?? undefined,
      accountId: row.account_id || undefined,
      accountName: row.account_name ?? undefined,
    };
  }

  getConnectedAccounts(): Array<{ provider: string; accountId: string; accountName?: string; expiresAt?: number }> {
    const rows = this.db.prepare('SELECT provider, account_id, account_name, expires_at FROM oauth_tokens').all() as any[];
    return rows.map((r) => ({
      provider: r.provider,
      accountId: r.account_id,
      accountName: r.account_name ?? undefined,
      expiresAt: r.expires_at ?? undefined,
    }));
  }

  removeToken(provider: OAuthProvider, accountId = ''): void {
    this.db.prepare('DELETE FROM oauth_tokens WHERE provider = ? AND account_id = ?').run(provider, accountId);
  }

  close(): void {
    this.db.close();
  }
}
