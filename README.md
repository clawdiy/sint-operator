# SINT Marketing Operator

> Upload one asset → get dozens of platform-ready deliverables in 60 seconds.

**An autonomous marketing operator** built on the SINT platform. Not a chatbot — a persistent background service that chains AI workflows into deterministic, auditable pipelines.

## What It Does

| Input | Output |
|-------|--------|
| Blog post | → Twitter thread, LinkedIn post, IG caption, TikTok script, email newsletter |
| Product announcement | → 7-day social calendar across all platforms |
| Topic + keywords | → Full SEO-optimized 1500-word article with meta tags |
| Any text content | → Platform-native formats respecting every platform's rules |

## Architecture

```
┌─────────────────────────────────────────────┐
│          SINT MARKETING OPERATOR            │
│                                             │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
│  │   CLI   │  │  Web API  │  │ Telegram  │  │
│  └────┬────┘  └────┬─────┘  └─────┬─────┘  │
│       └─────────┬──┴──────────────┘         │
│                 │                            │
│  ┌──────────────┴──────────────────────┐    │
│  │     MARKETING ORCHESTRATOR          │    │
│  │  • YAML Pipeline Engine             │    │
│  │  • Skill Resolver                   │    │
│  │  • Brand Context Injector           │    │
│  │  • Asset Router                     │    │
│  └──────┬────────────┬─────────────────┘    │
│         │            │                      │
│  ┌──────┴──┐  ┌──────┴──────┐               │
│  │  Skills │  │   Services  │               │
│  │         │  │             │               │
│  │• Repurp │  │• OpenAI LLM │               │
│  │• SEO    │  │• FFmpeg     │               │
│  │• Social │  │• Sharp      │               │
│  │• Format │  │• Puppeteer  │               │
│  └─────────┘  └─────────────┘               │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  SQLite FTS5 + Semantic Memory       │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Quick Start

```bash
# Clone
git clone https://github.com/clawdiy/sint-operator.git
cd sint-operator

# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your OpenAI API key

# Run
npm run dev
```

API starts at `http://localhost:18789`

## API Endpoints

### Quick Actions
```bash
# Repurpose content across platforms
curl -X POST http://localhost:18789/api/repurpose \
  -H "Content-Type: application/json" \
  -d '{
    "brandId": "sint-brand",
    "content": "Your content here...",
    "platforms": ["twitter", "linkedin", "instagram"]
  }'

# Generate SEO blog post
curl -X POST http://localhost:18789/api/blog \
  -H "Content-Type: application/json" \
  -d '{
    "brandId": "sint-brand",
    "topic": "Why autonomous AI operators beat chatbots",
    "keywords": ["AI operators", "business automation"]
  }'

# Generate social calendar
curl -X POST http://localhost:18789/api/calendar \
  -H "Content-Type: application/json" \
  -d '{
    "brandId": "sint-brand",
    "days": 7,
    "themes": ["product launch", "thought leadership", "community"]
  }'
```

### Management
```bash
GET  /api/brands          # List brands
POST /api/brands          # Create brand
GET  /api/pipelines       # List pipelines
GET  /api/runs            # List pipeline runs
POST /api/assets/upload   # Upload asset
```

## CLI

```bash
# Repurpose content
npm run pipeline -- repurpose -b sint-brand -p twitter,linkedin -t "Your content"

# Generate blog
npm run pipeline -- blog -b sint-brand -t "Topic" -k "keyword1,keyword2"

# Generate calendar
npm run pipeline -- calendar -b sint-brand -d 7 -t "theme1,theme2"

# List brands
npm run pipeline -- brands

# List pipelines
npm run pipeline -- pipelines
```

## Brand Configuration

Create a YAML file in `config/brands/`:

```yaml
id: my-brand
name: My Company
voice:
  tone: [professional, innovative, bold]
  style: "Direct and authoritative..."
  doNot: ["Use corporate buzzwords"]
  vocabulary: ["our preferred terms"]
  examples: ["Example post in our voice"]
visual:
  primaryColors: ["#000000"]
  fonts: ["Inter"]
platforms:
  - platform: twitter
    handle: "@mycompany"
    enabled: true
keywords: ["target keyword 1"]
competitors: ["Competitor A"]
```

## Custom Pipelines

Define YAML pipelines in `config/pipelines/`:

```yaml
id: my-pipeline
name: My Custom Pipeline
steps:
  - id: step1
    skill: content-repurpose
    inputs:
      text: "${inputs.text}"
      target_platforms: "${inputs.platforms}"
```

## Skills

| Skill | Description |
|-------|-------------|
| `content-repurpose` | One input → multi-platform outputs |
| `seo-blog` | Full SEO article with metadata |
| `social-calendar` | Multi-day content calendar |
| `platform-formatter` | Format to exact platform specs |

## Stack

- **Runtime:** Node.js 22+ / TypeScript
- **LLM:** OpenAI-compatible (GPT-4o, Claude, local models)
- **Memory:** SQLite FTS5 + cosine similarity vectors
- **Media:** FFmpeg, Sharp, Puppeteer
- **API:** Express.js

## Why Not Just Use ChatGPT?

Because this isn't a chatbot. It's a **persistent background service** with:
- Long-running workflows that chain 5-15 AI steps
- Platform-specific output formatting (TikTok ≠ LinkedIn ≠ Blog SEO)
- Brand memory that persists across every generation
- Deterministic YAML pipelines that produce auditable, repeatable results
- Local-first data sovereignty — client assets never leave your machine

---

Built by [SINT](https://sint.gg) — AI That Executes.
