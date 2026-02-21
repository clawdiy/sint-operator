# Social Publishing Setup Guide

SINT can publish generated content directly to Twitter/X and LinkedIn. This guide walks through the OAuth setup for each platform.

## Twitter/X Setup

### 1. Create a Twitter Developer App

1. Go to [developer.twitter.com](https://developer.twitter.com)
2. Sign in and navigate to the **Developer Portal**
3. Create a new **Project** and **App**
4. Set app permissions to **Read and Write**

### 2. Generate OAuth 1.0a Credentials

1. In your app settings, go to **Keys and Tokens**
2. Generate:
   - **API Key** (Consumer Key)
   - **API Key Secret** (Consumer Secret)
   - **Access Token**
   - **Access Token Secret**
3. Copy all four values

### 3. Configure SINT

Add to your `.env` file:

```env
TWITTER_API_KEY=your-api-key
TWITTER_API_SECRET=your-api-secret
TWITTER_ACCESS_TOKEN=your-access-token
TWITTER_ACCESS_SECRET=your-access-secret
```

### 4. Verify Connection

```bash
curl http://localhost:18789/api/publish/status
# Should show: { "twitter": { "configured": true } }
```

### 5. Publish a Tweet

```bash
curl -X POST http://localhost:18789/api/publish \
  -H "Content-Type: application/json" \
  -d '{"platform": "twitter", "content": "Hello from SINT! 🚀"}'
```

### Twitter Thread Support

```bash
curl -X POST http://localhost:18789/api/publish \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "twitter",
    "content": "Thread tweet 1",
    "thread": ["Thread tweet 2", "Thread tweet 3"]
  }'
```

---

## LinkedIn Setup

### 1. Create a LinkedIn App

1. Go to [linkedin.com/developers](https://www.linkedin.com/developers/)
2. Click **Create App**
3. Fill in app details (name, logo, company page)
4. Under **Products**, request access to:
   - **Share on LinkedIn**
   - **Sign In with LinkedIn using OpenID Connect**

### 2. Generate OAuth 2.0 Token

LinkedIn uses OAuth 2.0. For server-to-server posting, you need a long-lived access token:

1. In your app settings, go to **Auth**
2. Note your **Client ID** and **Client Secret**
3. Generate an access token via the OAuth 2.0 flow:

```bash
# Step 1: Get authorization code (open in browser)
https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/callback&scope=w_member_social%20openid%20profile

# Step 2: Exchange code for token
curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
  -d "grant_type=authorization_code&code=YOUR_CODE&client_id=YOUR_CLIENT_ID&client_secret=YOUR_SECRET&redirect_uri=http://localhost:3000/callback"
```

### 3. Get Your Person URN

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  https://api.linkedin.com/v2/userinfo
# Response includes "sub" field — your Person URN is: urn:li:person:YOUR_SUB
```

### 4. Configure SINT

```env
LINKEDIN_ACCESS_TOKEN=your-access-token
LINKEDIN_PERSON_URN=urn:li:person:your-person-id
```

### 5. Verify & Publish

```bash
# Verify
curl http://localhost:18789/api/publish/status

# Post
curl -X POST http://localhost:18789/api/publish \
  -H "Content-Type: application/json" \
  -d '{"platform": "linkedin", "content": "Exciting update from our team! #marketing #AI"}'
```

---

## Multi-Platform Publishing

Publish to both platforms simultaneously:

```bash
curl -X POST http://localhost:18789/api/publish/multi \
  -H "Content-Type: application/json" \
  -d '{
    "requests": [
      {"platform": "twitter", "content": "Short tweet version 🚀"},
      {"platform": "linkedin", "content": "Longer LinkedIn version with more detail about our latest AI-powered content strategy..."}
    ]
  }'
```

## Queue System

Schedule posts for later:

```bash
# Queue a post
curl -X POST http://localhost:18789/api/publish/queue \
  -H "Content-Type: application/json" \
  -d '{"platform": "twitter", "content": "Scheduled tweet"}'

# View queue
curl http://localhost:18789/api/publish/queue

# Process all queued posts now
curl -X POST http://localhost:18789/api/publish/process

# Cancel a queued post
curl -X DELETE http://localhost:18789/api/publish/queue/ITEM_ID
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Invalid or expired token | Regenerate tokens |
| `403 Forbidden` | Insufficient permissions | Check app permissions (Read+Write) |
| `429 Too Many Requests` | Rate limit hit | Wait and retry; SINT has built-in retry logic |
| `Platform not configured` | Missing env vars | Check `.env` for all required keys |

## Rate Limits

- **Twitter:** 300 tweets/3 hours (user), 200 requests/15 min (app)
- **LinkedIn:** 100 requests/day for posting

SINT respects these limits and will queue excess posts automatically.
