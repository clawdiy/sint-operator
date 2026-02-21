/**
 * Twitter/X Publishing Client
 * 
 * Posts tweets and threads via Twitter API v2.
 * Requires: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
 */

import crypto from 'crypto';
import https from 'https';
import type { Logger } from '../../core/types.js';
import type { TwitterCredentials } from './types.js';

export interface TwitterConfig extends TwitterCredentials {}

export interface TweetResult {
  id: string;
  text: string;
  url: string;
}

export interface ThreadResult {
  tweets: TweetResult[];
  threadUrl: string;
}

function getConfig(override?: TwitterCredentials): TwitterConfig | null {
  const apiKey = override?.apiKey ?? process.env.TWITTER_API_KEY;
  const apiSecret = override?.apiSecret ?? process.env.TWITTER_API_SECRET;
  const accessToken = override?.accessToken ?? process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = override?.accessSecret ?? process.env.TWITTER_ACCESS_SECRET;
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) return null;
  return { apiKey, apiSecret, accessToken, accessSecret };
}

/**
 * Generate OAuth 1.0a signature for Twitter API v2
 */
function generateOAuthHeader(
  method: string,
  url: string,
  config: TwitterConfig,
  body?: string,
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');

  const params: Record<string, string> = {
    oauth_consumer_key: config.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: config.accessToken,
    oauth_version: '1.0',
  };

  const paramString = Object.keys(params)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(paramString),
  ].join('&');

  const signingKey = `${encodeURIComponent(config.apiSecret)}&${encodeURIComponent(config.accessSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  params.oauth_signature = signature;

  const header = Object.keys(params)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
    .join(', ');

  return `OAuth ${header}`;
}

/**
 * Make authenticated request to Twitter API v2
 */
async function twitterRequest(
  method: string,
  path: string,
  config: TwitterConfig,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; data?: unknown; error?: string; status: number }> {
  const url = `https://api.twitter.com${path}`;
  const bodyStr = body ? JSON.stringify(body) : undefined;
  const authHeader = generateOAuthHeader(method, url, config, bodyStr);

  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method,
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr).toString() } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const status = res.statusCode ?? 500;
          try {
            const parsed = JSON.parse(data);
            if (status >= 200 && status < 300) {
              resolve({ ok: true, data: parsed.data, status });
            } else {
              resolve({ ok: false, error: parsed.detail || parsed.title || JSON.stringify(parsed), status });
            }
          } catch {
            resolve({ ok: false, error: data, status });
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
 * Post a single tweet.
 */
export async function postTweet(
  text: string,
  logger?: Logger,
  replyToId?: string,
  credentials?: TwitterCredentials,
): Promise<TweetResult | null> {
  const config = getConfig(credentials);
  if (!config) {
    logger?.warn('Twitter credentials not configured');
    return null;
  }

  const body: Record<string, unknown> = { text };
  if (replyToId) {
    body.reply = { in_reply_to_tweet_id: replyToId };
  }

  const result = await twitterRequest('POST', '/2/tweets', config, body);
  if (!result.ok) {
    logger?.error('Tweet failed', { error: result.error, status: result.status });
    return null;
  }

  const data = result.data as { id: string; text: string };
  logger?.info('Tweet posted', { id: data.id });
  return {
    id: data.id,
    text: data.text,
    url: `https://x.com/i/status/${data.id}`,
  };
}

/**
 * Post a thread (array of tweets).
 */
export async function postThread(
  tweets: string[],
  logger?: Logger,
  credentials?: TwitterCredentials,
): Promise<ThreadResult | null> {
  if (tweets.length === 0) return null;

  const config = getConfig(credentials);
  if (!config) {
    logger?.warn('Twitter credentials not configured');
    return null;
  }

  const results: TweetResult[] = [];
  let lastId: string | undefined;

  for (let i = 0; i < tweets.length; i++) {
    const result = await postTweet(tweets[i], logger, lastId, credentials);
    if (!result) {
      logger?.error(`Thread failed at tweet ${i + 1}/${tweets.length}`);
      break;
    }
    results.push(result);
    lastId = result.id;

    // Rate limit safety: 200ms between tweets
    if (i < tweets.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return {
    tweets: results,
    threadUrl: results[0]?.url ?? '',
  };
}

/**
 * Delete a tweet.
 */
export async function deleteTweet(
  tweetId: string,
  logger?: Logger,
  credentials?: TwitterCredentials,
): Promise<boolean> {
  const config = getConfig(credentials);
  if (!config) return false;

  const result = await twitterRequest('DELETE', `/2/tweets/${tweetId}`, config);
  if (!result.ok) {
    logger?.error('Delete tweet failed', { tweetId, error: result.error });
  }
  return result.ok;
}

/**
 * Check if Twitter is configured.
 */
export function isTwitterConfigured(credentials?: TwitterCredentials): boolean {
  return getConfig(credentials) !== null;
}
