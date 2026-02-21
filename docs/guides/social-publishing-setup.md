# Social Publishing Setup Guide

SINT publishes generated content directly to Twitter/X and LinkedIn.

## Twitter/X Setup

### 1. Create a Developer App

1. Go to [developer.twitter.com](https://developer.twitter.com)
2. Create a Project and App
3. Set permissions to **Read and Write**

### 2. Generate Credentials

In Keys and Tokens, generate:
- API Key + API Key Secret
- Access Token + Access Token Secret

### 3. Configure

```env
TWITTER_API_KEY=your-api-key
TWITTER_API_SECRET=your-api-secret
TWITTER_ACCESS_TOKEN=your-access-token
TWITTER_ACCESS_SECRET=your-access-secret
```

### 4. Test

```bash
curl http://localhost:18789/api/publish/status
curl -X POST http://localhost:18789/api/publish \
  -H "Content-Type: application/json" \
  -d '{"platform": "twitter", "content": "Hello from SINT!"}'
```

---

## LinkedIn Setup

### 1. Create a LinkedIn App

1. Go to [linkedin.com/developers](https://www.linkedin.com/developers/)
2. Create an app and request **Share on LinkedIn** access

### 2. Generate OAuth 2.0 Token

```bash
# Get auth code (open in browser):
https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=YOUR_ID&redirect_uri=http://localhost:3000/callback&scope=w_member_social

# Exchange for token:
curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
  -d "grant_type=authorization_code&code=CODE&client_id=ID&client_secret=SECRET&redirect_uri=http://localhost:3000/callback"
```

### 3. Get Person URN

```bash
curl -H "Authorization: Bearer TOKEN" https://api.linkedin.com/v2/userinfo
# Use the "sub" field: urn:li:person:YOUR_SUB
```

### 4. Configure

```env
LINKEDIN_ACCESS_TOKEN=your-token
LINKEDIN_PERSON_URN=urn:li:person:your-id
```

---

## Multi-Platform Publishing

```bash
curl -X POST http://localhost:18789/api/publish/multi \
  -H "Content-Type: application/json" \
  -d '{"requests": [
    {"platform": "twitter", "content": "Short tweet"},
    {"platform": "linkedin", "content": "Longer LinkedIn post..."}
  ]}'
```

## Queue System

```bash
POST /api/publish/queue     # Queue a post
GET  /api/publish/queue     # View queue
POST /api/publish/process   # Process all queued
DELETE /api/publish/queue/ID # Cancel
```
