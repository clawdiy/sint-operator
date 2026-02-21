# Getting Started with SINT Marketing Operator

This guide takes you from zero to generating your first content in under 5 minutes.

## Prerequisites

- Node.js 18+ (or Docker)
- An API key from [OpenAI](https://platform.openai.com/api-keys) or [Anthropic](https://console.anthropic.com)

## Step 1: Install

```bash
git clone https://github.com/clawdiy/sint-operator.git
cd sint-operator
npm install
```

Or with Docker:
```bash
docker-compose up -d
```

## Step 2: Configure API Keys

**Option A: Environment variables**
```bash
cp .env.example .env
# Edit .env and add at least one:
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

**Option B: Via the UI**
Start the server first, then go to Settings (gear icon) and paste your key.

## Step 3: Start the Server

```bash
npm run dev
# Open http://localhost:18789
```

## Step 4: Generate Content

### Repurpose Content
1. Paste text into the **Repurpose Content** box on the Dashboard
2. Select target platforms (Twitter, LinkedIn, etc.)
3. Choose a brand profile
4. Click **Repurpose**

### SEO Blog
1. Enter a topic and keywords
2. Click **Generate Blog**

### Content Calendar
1. Set number of days and themes
2. Click **Generate Calendar**

## Step 5: Create Your Brand

1. Go to Brands page
2. Click **+ New Brand**
3. Set voice tone, style, do-not list, and example content
4. Your brand voice is now injected into every pipeline

## Dry-Run Mode

With no API keys, SINT runs in dry-run mode with mock data. Great for testing the UI and pipeline flow without spending tokens.

## Next Steps

- [Social Publishing Setup](./social-publishing-setup.md) — Connect Twitter and LinkedIn
- Run full pipelines from the Pipelines page
- Monitor usage in the Usage dashboard
