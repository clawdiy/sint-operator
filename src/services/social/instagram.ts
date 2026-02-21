/**
 * Instagram Publishing Client
 *
 * Publishes image posts via the Instagram Graph API.
 * Requires:
 * - INSTAGRAM_ACCESS_TOKEN
 * - INSTAGRAM_BUSINESS_ACCOUNT_ID (or INSTAGRAM_IG_USER_ID)
 */

import https from 'https';
import type { Logger } from '../../core/types.js';

export interface InstagramConfig {
  accessToken: string;
  businessAccountId: string;
  graphVersion: string;
}

export interface InstagramPostResult {
  id: string;
  url: string;
}

function getConfig(): InstagramConfig | null {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ?? process.env.INSTAGRAM_IG_USER_ID;
  const graphVersion = process.env.INSTAGRAM_GRAPH_VERSION ?? 'v22.0';
  if (!accessToken || !businessAccountId) return null;
  return { accessToken, businessAccountId, graphVersion };
}

async function instagramRequest(
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, string | undefined>,
): Promise<{ ok: boolean; data?: unknown; error?: string; status: number }> {
  const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
  const query = new URLSearchParams(filtered as Record<string, string>).toString();
  const requestPath = method === 'GET'
    ? `${path}${query ? `?${query}` : ''}`
    : path;
  const body = method === 'POST' ? query : undefined;

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'graph.facebook.com',
        path: requestPath,
        method,
        headers: body
          ? {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body).toString(),
          }
          : undefined,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const status = res.statusCode ?? 500;
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (status >= 200 && status < 300) {
              resolve({ ok: true, data: parsed, status });
            } else {
              resolve({
                ok: false,
                status,
                error: parsed.error?.message || JSON.stringify(parsed),
              });
            }
          } catch {
            resolve({ ok: false, status, error: data || `HTTP ${status}` });
          }
        });
      },
    );

    req.on('error', (err) => resolve({ ok: false, status: 0, error: err.message }));
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Publish an Instagram image post.
 *
 * Note: Instagram requires a publicly accessible image URL.
 */
export async function postInstagramImage(
  caption: string,
  imageUrl: string,
  logger?: Logger,
): Promise<InstagramPostResult | null> {
  const config = getConfig();
  if (!config) {
    logger?.warn('Instagram credentials not configured');
    return null;
  }

  if (!/^https?:\/\//i.test(imageUrl)) {
    logger?.error('Instagram post requires a public image URL');
    return null;
  }

  const createMedia = await instagramRequest(
    'POST',
    `/${config.graphVersion}/${config.businessAccountId}/media`,
    {
      image_url: imageUrl,
      caption,
      access_token: config.accessToken,
    },
  );
  if (!createMedia.ok) {
    logger?.error('Instagram media creation failed', { error: createMedia.error, status: createMedia.status });
    return null;
  }

  const creationId = (createMedia.data as { id?: string })?.id;
  if (!creationId) {
    logger?.error('Instagram media creation did not return an ID');
    return null;
  }

  const publishMedia = await instagramRequest(
    'POST',
    `/${config.graphVersion}/${config.businessAccountId}/media_publish`,
    {
      creation_id: creationId,
      access_token: config.accessToken,
    },
  );
  if (!publishMedia.ok) {
    logger?.error('Instagram media publish failed', { error: publishMedia.error, status: publishMedia.status });
    return null;
  }

  const mediaId = (publishMedia.data as { id?: string })?.id;
  if (!mediaId) {
    logger?.error('Instagram publish did not return a media ID');
    return null;
  }

  const permalinkLookup = await instagramRequest(
    'GET',
    `/${config.graphVersion}/${mediaId}`,
    {
      fields: 'permalink',
      access_token: config.accessToken,
    },
  );

  const permalink = (permalinkLookup.data as { permalink?: string })?.permalink ?? '';
  logger?.info('Instagram post published', { id: mediaId });
  return { id: mediaId, url: permalink };
}

export function isInstagramConfigured(): boolean {
  return getConfig() !== null;
}

export async function verifyInstagramToken(logger?: Logger): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;

  const result = await instagramRequest(
    'GET',
    `/${config.graphVersion}/${config.businessAccountId}`,
    {
      fields: 'id,username',
      access_token: config.accessToken,
    },
  );

  if (!result.ok) {
    logger?.warn('Instagram token invalid', { error: result.error, status: result.status });
    return false;
  }

  logger?.info('Instagram token valid');
  return true;
}
