/**
 * LinkedIn Publishing Client
 * 
 * Posts updates via LinkedIn Marketing API v2.
 * Requires: LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN
 * 
 * Token: Get from LinkedIn Developer Portal → OAuth 2.0
 * Scopes needed: w_member_social, r_liteprofile
 */

import https from 'https';
import type { Logger } from '../../core/types.js';

export interface LinkedInConfig {
  accessToken: string;
  personUrn: string; // format: urn:li:person:XXXX
}

export interface LinkedInPostResult {
  id: string;
  url: string;
}

function getConfig(): LinkedInConfig | null {
  const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  const personUrn = process.env.LINKEDIN_PERSON_URN;
  if (!accessToken || !personUrn) return null;
  return { accessToken, personUrn };
}

/**
 * Make authenticated request to LinkedIn API
 */
async function linkedinRequest(
  method: string,
  path: string,
  config: LinkedInConfig,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; data?: unknown; error?: string; status: number; headers?: Record<string, string> }> {
  const bodyStr = body ? JSON.stringify(body) : undefined;

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.linkedin.com',
        path,
        method,
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': '202401',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr).toString() } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const status = res.statusCode ?? 500;
          const headers = res.headers as Record<string, string>;
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (status >= 200 && status < 300) {
              resolve({ ok: true, data: parsed, status, headers });
            } else {
              resolve({ ok: false, error: parsed.message || JSON.stringify(parsed), status, headers });
            }
          } catch {
            // 201 Created often has no body but has x-restli-id header
            if (status === 201) {
              resolve({ ok: true, data: {}, status, headers });
            } else {
              resolve({ ok: false, error: data || `HTTP ${status}`, status, headers });
            }
          }
        });
      },
    );
    req.on('error', (err) => resolve({ ok: false, error: err.message, status: 0 }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Post a text update to LinkedIn.
 */
export async function postLinkedInUpdate(
  text: string,
  logger?: Logger,
): Promise<LinkedInPostResult | null> {
  const config = getConfig();
  if (!config) {
    logger?.warn('LinkedIn credentials not configured');
    return null;
  }

  const body = {
    author: config.personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const result = await linkedinRequest('POST', '/v2/ugcPosts', config, body);
  if (!result.ok) {
    logger?.error('LinkedIn post failed', { error: result.error, status: result.status });
    return null;
  }

  // LinkedIn returns the post ID in the x-restli-id header or response body
  const postId = (result.headers?.['x-restli-id'] as string) ||
    (result.data as Record<string, string>)?.id || '';

  // LinkedIn post URL format
  const activityId = postId.replace('urn:li:share:', '');
  const url = activityId
    ? `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}`
    : '';

  logger?.info('LinkedIn post published', { id: postId });
  return { id: postId, url };
}

/**
 * Post an article share to LinkedIn (with link preview).
 */
export async function postLinkedInArticle(
  text: string,
  articleUrl: string,
  title: string,
  description?: string,
  logger?: Logger,
): Promise<LinkedInPostResult | null> {
  const config = getConfig();
  if (!config) {
    logger?.warn('LinkedIn credentials not configured');
    return null;
  }

  const body = {
    author: config.personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'ARTICLE',
        media: [
          {
            status: 'READY',
            originalUrl: articleUrl,
            title: { text: title },
            description: description ? { text: description } : undefined,
          },
        ],
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const result = await linkedinRequest('POST', '/v2/ugcPosts', config, body);
  if (!result.ok) {
    logger?.error('LinkedIn article post failed', { error: result.error, status: result.status });
    return null;
  }

  const postId = (result.headers?.['x-restli-id'] as string) || '';
  logger?.info('LinkedIn article published', { id: postId });
  return { id: postId, url: '' };
}

/**
 * Check if LinkedIn is configured.
 */
export function isLinkedInConfigured(): boolean {
  return getConfig() !== null;
}

/**
 * Verify LinkedIn token is valid.
 */
export async function verifyLinkedInToken(logger?: Logger): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;

  const result = await linkedinRequest('GET', '/v2/me', config);
  if (!result.ok) {
    logger?.warn('LinkedIn token invalid', { error: result.error });
    return false;
  }
  logger?.info('LinkedIn token valid');
  return true;
}
