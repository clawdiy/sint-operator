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
# Edit .env — add at least one:
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

**Option B: Via the UI**
Start the server first, then configure keys in Settings (⚙️).

## Step 3: Start the Server

```bash
npm run dev
# → http://localhost:18789
```

You'll see:
```
╔══════════════════════════════════════════════════╗
║     SINT MARKETING OPERATOR v0.5.0              ║
║     "No prompts. Just outcomes."                ║
╚══════════════════════════════════════════════════╝
```

## Step 4: Open the Dashboard

Navigate to [http://localhost:18789](http://localhost:18789). You'll see:

- **System Health** — Green dot = all good
- **3 Quick Actions** — Repurpose, SEO Blog, Content Calendar
- **5 Brands** — 1 default (SINT) + 4 templates

## Step 5: Generate Your First Content

### Repurpose Content
1. Paste any text (blog post, article, tweet) into the **Repurpose Content** box
2. Select target platforms (Twitter, LinkedIn, Instagram, etc.)
3. Choose a brand profile
4. Click **▶ Repurpose**

### Generate an SEO Blog
1. Enter a topic: "How AI transforms content marketing"
2. Add keywords: "AI marketing, content automation, ROI"
3. Click **▶ Generate Blog**

### Create a Content Calendar
1. Set days (7 for a week)
2. Add themes: "product launch, thought leadership"
3. Click **▶ Generate Calendar**

## Step 6: View Results

- Results appear in the **Recent Runs** section on the Dashboard
- Click any run to see full outputs in the **Results** page (📊)
- Export as Markdown or JSON
- Copy individual posts to clipboard

## Step 7: Create Your Brand

1. Go to **Brands** (🎨)
2. Click **+ New Brand**
3. Fill in:
   - Brand name
   - Voice tone (professional, witty, bold, etc.)
   - Style description
   - Do-Not list (things your brand never says)
   - Example content (paste existing posts for voice matching)
4. Click **Create Brand**

Your brand voice is now injected into every pipeline run.

## What's Next?

- **Run full pipelines** — Go to Pipelines (⚡) for all 7 pipeline types with custom inputs
- **Set up social publishing** — See [Social Publishing Setup Guide](./social-publishing-setup.md)
- **Configure notifications** — Set `TELEGRAM_BOT_TOKEN` for pipeline completion alerts
- **Explore skills** — View all 15 AI skills in Skills (🧩)
- **Monitor usage** — Track token consumption and costs in Usage (📈)

## Dry-Run Mode

If no API keys are configured, SINT runs in **dry-run mode** — all pipelines execute with mock data so you can test the UI and pipeline flow without spending tokens. You'll see `[Mock response — configure OPENAI_API_KEY for real output]` in results.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "LLM calls will fail" warning | Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` |
| Pipeline stuck on "running" | Check server logs; may be a timeout — increase `DEFAULT_STEP_TIMEOUT_MS` |
| Brands not showing | If auth is enabled, brands are user-isolated — ensure you're logged in |
| "Unauthorized" errors | Set `AUTH_ENABLED=false` in `.env` or complete auth setup |
| Docker build fails | Run `npm install` first to generate `package-lock.json`, then rebuild |
