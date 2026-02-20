# SINT Marketing Operator

> Upload one asset → get dozens of platform-ready deliverables in 60 seconds.

A locally-hosted, always-on AI agent operator purpose-built for marketing teams and agencies. Built on OpenClaw + Eliza OS.

**Not a chatbot.** A persistent background service with deterministic YAML pipelines, brand memory, and local-first data sovereignty.

## Target Metric

A non-technical marketing manager uploads a 30-minute video and gets back **5 TikTok clips + 3 LinkedIn posts + 1 SEO blog post in under 5 minutes.**

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 SINT MARKETING OPERATOR                 │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │   Electron   │  │   Web UI     │  │  Telegram/    │ │
│  │   Launcher   │  │  :18789      │  │  Slack        │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘ │
│         └─────────────┬───┴──────────────────┘          │
│  ┌────────────────────┴────────────────────────────┐    │
│  │         MARKETING ORCHESTRATOR                  │    │
│  │  • YAML Pipeline Engine  • Model Router         │    │
│  │  • Progressive Skills    • Brand Context        │    │
│  │  • Security Allowlist    • Approval Gates       │    │
│  └──────┬───────────────┬──────────────┬───────────┘    │
│  ┌──────┴───┐  ┌────────┴────┐  ┌──────┴──────────┐    │
│  │ OpenClaw │  │  Eliza OS   │  │ Tool Services   │    │
│  │ Runtime  │  │  Social     │  │ FFmpeg│Whisper  │    │
│  │ Brain    │  │  Twitter    │  │ Sharp │Playwright│   │
│  │ Memory   │  │  LinkedIn   │  │ Canvas│Stability │   │
│  └──────────┘  └─────────────┘  └─────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  SQLite FTS5 + ChromaDB │ Metering │ Brand Mem  │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Pipelines

| Pipeline | Trigger | What It Does |
|----------|---------|-------------|
| **Content Repurpose** | `repurpose\|shred` | Video/article → 5 clips + LinkedIn posts + blog + social |
| **SEO Blog Writer** | `seo blog\|write blog` | SERP analysis → gap analysis → 1500-word article + schema |
| **Content Calendar** | `content calendar` | Trend research → strategy → 30-day multi-platform calendar |
| **Brand Identity** | `brand identity` | Quiz → research → colors → typography → logos → guidelines PDF |
| **Ad Variations** | `ad variations` | Product photo → 10 headlines → 10 layouts → campaign package |
| **Visual Metadata** | `tag images` | Batch images → alt-text + filenames + SEO tags |
| **Infographic** | `infographic` | Data → visual metaphors → branded infographic |

## Skills (12 Built-in)

| Skill | Tier | Cost | Description |
|-------|------|------|-------------|
| `asset-ingester` | — | 5 | Video/audio/URL/doc intake + Whisper transcription |
| `content-analyzer` | Routine | 10 | Themes, hooks, data points, platform suitability |
| `content-repurpose` | Complex | 15 | Multi-platform content generation from content map |
| `video-clipper` | — | 20 | Extract clips, burn captions, watermark, 9:16 export |
| `linkedin-writer` | Routine | 8 | LinkedIn posts with hooks/insights/CTAs |
| `seo-blog` | Complex | 20 | Full SEO article with outline + writing |
| `serp-scraper` | Routine | 5 | Google SERP analysis + content gap identification |
| `seo-optimizer` | Routine | 5 | Schema markup, meta tags, keyword density, scorecard |
| `social-calendar` | Complex | 15 | Multi-day content calendar with strategy |
| `brand-researcher` | Complex | 15 | Industry trends, competitor analysis, color theory |
| `output-packager` | — | 2 | Organize deliverables into structured folders |
| `platform-formatter` | Routine | 3 | Format to exact platform specs |

## Model Routing

| Task Type | Model | Use Case |
|-----------|-------|----------|
| Complex | Claude Opus 4.6 | Strategy, analysis, long-form writing |
| Routine | Claude Sonnet 4.5 | Formatting, captions, simple generation |
| Batch | Claude Haiku 4.5 | Image analysis, data extraction |
| Fallback | Kimi-K2.5 | Rate limit overflow |

## Quick Start

```bash
git clone https://github.com/clawdiy/sint-operator.git
cd sint-operator
npm install
cp .env.example .env  # Add your API key
npm run dev
```

## Docker

```bash
cp .env.example .env
docker-compose up -d
```

## API

```bash
# Repurpose content
POST /api/repurpose { brandId, content, platforms }

# Generate blog
POST /api/blog { brandId, topic, keywords }

# Generate calendar
POST /api/calendar { brandId, days, themes }

# Run any pipeline
POST /api/pipelines/:id/run { brandId, inputs }

# Usage & metering
GET  /api/usage
POST /api/usage/limits { daily, monthly, perRun }

# Discovery
GET  /api/skills
GET  /api/brands
GET  /api/pipelines
```

## Security

- **Command Allowlist**: Only approved executables
- **Network Allowlist**: Only approved API endpoints
- **Approval Gates**: Publishing requires human OK
- **Docker Sandbox**: Isolated execution, no host access
- **Metering**: Daily/monthly cost limits with hard stops

## Brand Memory

```
/memory/brands/<brand-id>/
  brand-profile.json
  color-palette.json
  typography.json
  voice-examples/
    linkedin-approved.md
    twitter-approved.md
  assets/
    logo-primary.svg
  history/
    2026-02-content-calendar.csv
```

Approved content is embedded in ChromaDB for semantic search. New generations retrieve the 5 most similar approved pieces to maintain voice consistency.

## Competitive Moat

The moat is **methodology, not connectivity**:
- Any agent can connect to Twitter via MCP
- Only SINT has pre-built marketing pipelines encoding best practices
- Brand memory ensures consistency one-off prompting can never achieve
- Progressive disclosure = 10x less token burn than competitors

---

Built by [SINT](https://sint.gg) — AI That Executes.
