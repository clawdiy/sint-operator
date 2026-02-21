# SINT Marketing Operator v0.5.0

> Upload one asset → get dozens of platform-ready deliverables in 60 seconds.

**Live demo:** [sint-operator-production.up.railway.app](https://sint-operator-production.up.railway.app)

A self-hosted AI marketing operator with deterministic YAML pipelines, brand memory, and multi-model routing. Not a chatbot — a persistent service that plans, executes, and delivers real content.

Built by [SINT](https://sint.gg) — AI That Executes.

## What's New in v0.5.0

- **Dual LLM Support** — Native Anthropic SDK + OpenAI SDK. Claude models route to Anthropic, GPT models route to OpenAI. Hot-reload API keys without restart.
- **15 Skills** — Added newsletter generator + competitor content analyzer
- **Social Publishing** — Twitter/X (OAuth 1.0a) + LinkedIn (OAuth 2.0) with queue system
- **Notifications** — In-app + Telegram pipeline completion alerts with SSE streaming
- **MCP Skill Server** — All 15 skills exposed as MCP tools for external agent integration
- **Auth System** — Optional JWT auth with user-isolated brands and API key storage (BYOK)
- **4 Template Brands** — SaaS Startup, E-commerce/DTC, B2B Services, Personal Creator
- **CI/CD** — GitHub Actions pipeline (build + test + type check)
- **Production Dockerfile** — Multi-stage build, health checks, Railway-ready

## Quick Start

```bash
git clone https://github.com/clawdiy/sint-operator.git
cd sint-operator
npm install
cp .env.example .env  # Add your API keys
npm run dev            # → http://localhost:18789
```

### Docker

```bash
cp .env.example .env
docker-compose up -d
```

### Railway

Set `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` in Railway env vars. Deploys automatically on push to `main`.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              SINT MARKETING OPERATOR                │
│                                                     │
│  ┌────────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Web UI    │  │ REST API │  │ MCP / Telegram │  │
│  │  React SPA │  │ Express  │  │ Integrations   │  │
│  └─────┬──────┘  └────┬─────┘  └──────┬─────────┘  │
│        └───────────┬───┴───────────────┘            │
│  ┌─────────────────┴─────────────────────────────┐  │
│  │          MARKETING ORCHESTRATOR               │  │
│  │  • YAML Pipeline Engine  • LLM Router         │  │
│  │  • 15 Skills (pluggable) • Brand Context      │  │
│  │  • Retry + Timeouts      • Cost Metering      │  │
│  └──────┬────────────┬───────────────┬───────────┘  │
│  ┌──────┴──────┐  ┌──┴────────┐  ┌──┴───────────┐  │
│  │ Anthropic   │  │ OpenAI    │  │ Tool Chain   │  │
│  │ Claude 4.6  │  │ GPT-4o    │  │ Social Pub   │  │
│  │ Claude 4.5  │  │ GPT-4o-m  │  │ Telegram     │  │
│  └─────────────┘  └───────────┘  └──────────────┘  │
│  ┌─────────────────────────────────────────────────┐│
│  │  SQLite (memory + metering) │ Brand Profiles   ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## Pipelines

7 pre-built YAML pipelines in `config/pipelines/`:

| Pipeline | What It Does | Skills Used |
|----------|-------------|-------------|
| **Content Repurpose** | Long-form → multi-platform content suite | asset-ingester → content-analyzer → content-repurpose |
| **SEO Blog** | Topic → 1500-word SEO article with schema | serp-scraper → seo-blog → seo-optimizer |
| **Content Calendar** | Strategy → multi-day social media plan | content-analyzer → social-calendar → platform-formatter |
| **Brand Identity** | Research → complete brand identity system | brand-researcher → output-packager |
| **Ad Variations** | Product → headline + layout variations | content-analyzer → content-repurpose |
| **Visual Metadata** | Images → SEO metadata + alt-text | content-analyzer → seo-optimizer |
| **Infographic** | Data → branded infographic concept | content-analyzer → output-packager |

## Skills (15)

| Skill | Cost (CU) | Description |
|-------|-----------|-------------|
| `asset-ingester` | 5 | Video/audio/URL/doc intake + transcription |
| `content-analyzer` | 10 | Themes, hooks, platform suitability scoring |
| `content-repurpose` | 15 | Multi-platform content from content map |
| `seo-blog` | 20 | Full SEO article with outline + writing |
| `social-calendar` | 15 | Multi-day calendar with posting schedule |
| `platform-formatter` | 3 | Format to exact platform specs + limits |
| `video-clipper` | 20 | Extract clips, captions, 9:16 export |
| `linkedin-writer` | 8 | LinkedIn posts with hooks/insights/CTAs |
| `output-packager` | 2 | Organize deliverables into folders |
| `brand-researcher` | 15 | Industry trends, competitor visual language |
| `serp-scraper` | 5 | Google SERP analysis + content gaps |
| `seo-optimizer` | 5 | Schema markup, meta tags, keyword density |
| `notifier` | 1 | Multi-channel notifications (Telegram/Slack/email) |
| `newsletter` | 15 | Email newsletter with subject, sections, CTAs |
| `competitor-analyzer` | 15 | Competitor content strategy analysis |

## LLM Model Routing

| Tier | Default Model | Use Case | Timeout |
|------|--------------|----------|---------|
| Complex | `claude-opus-4-6` | Strategy, analysis, long-form | 60s |
| Routine | `claude-sonnet-4-5` | Formatting, short-form | 30s |
| Fallback | `kimi-k2.5` | Rate limit overflow | 30s |

Override via env vars: `SINT_MODEL_COMPLEX`, `SINT_MODEL_ROUTINE`, `SINT_MODEL_FALLBACK`.

**Dual SDK support:** Claude models → Anthropic SDK, GPT models → OpenAI SDK.

## API Reference

### Quick Actions
```
POST /api/repurpose    { brandId, content, platforms }
POST /api/blog         { brandId, topic, keywords }
POST /api/calendar     { brandId, days, themes }
```

### Pipelines
```
GET  /api/pipelines                    List all pipelines
GET  /api/pipelines/:id               Get pipeline details
POST /api/pipelines/:id/run           Run pipeline { brandId, inputs }
```

### Runs
```
GET  /api/runs                         List runs (?status=&pipelineId=&brandId=)
GET  /api/runs/:id                     Get run details + outputs
POST /api/runs/:id/cancel              Cancel running pipeline
GET  /api/runs/:id/stream              SSE stream of run progress
```

### Brands
```
GET  /api/brands                       List brands
GET  /api/brands/:id                   Get brand details
POST /api/brands                       Create brand
```

### Social Publishing
```
POST /api/publish                      Publish to single platform
POST /api/publish/multi                Publish to multiple platforms
POST /api/publish/queue                Queue for later
POST /api/publish/process              Process pending queue items now
GET  /api/publish/queue                List queue
GET  /api/publish/dead-letter          List permanently failed queue items
POST /api/publish/retry/:id            Retry a dead-letter queue item
DELETE /api/publish/queue/:id          Cancel queued item
GET  /api/publish/status               Platform configuration
```

### Webhooks
```
POST /api/webhooks                     Ingest signed external webhook
GET  /api/webhooks                     List ingested webhooks (auth required)
```

### MCP (Model Context Protocol)
```
GET  /mcp/tools                        List skills as MCP tools
POST /mcp/tools/call                   Execute skill via MCP
GET  /mcp/health                       MCP health
```

### Settings & Auth
```
POST /api/settings/api-key             Save OpenAI key
GET  /api/settings/api-key             Check OpenAI key
POST /api/settings/anthropic-key       Save Anthropic key
GET  /api/settings/anthropic-key       Check Anthropic key
GET  /api/onboarding/status            Onboarding state
POST /api/onboarding/setup             Complete onboarding
GET  /api/notifications                List notifications
GET  /api/notifications/stream         SSE notification stream
GET  /health                           System health + version
```

## Environment Variables

```env
# Required (at least one)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Model overrides
SINT_MODEL_COMPLEX=claude-opus-4-6
SINT_MODEL_ROUTINE=claude-sonnet-4-5
SINT_MODEL_FALLBACK=kimi-k2.5

# Social Publishing
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_PERSON_URN=urn:li:person:XXX

# Notifications
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Auth (disabled by default)
AUTH_ENABLED=false
JWT_SECRET=

# Server
PORT=18789

# Publish queue worker (background scheduler)
PUBLISH_QUEUE_WORKER_ENABLED=true
PUBLISH_QUEUE_WORKER_INTERVAL_MS=30000

# Webhook auth (choose one mode)
WEBHOOK_HMAC_SECRET=
WEBHOOK_HMAC_TOLERANCE_SEC=300
WEBHOOK_INGEST_SECRET=
```

## Template Brands

4 pre-built brand profiles in `config/brands/`:

- **SaaS Startup** — Clear, confident, problem-solution
- **E-commerce / DTC** — Warm, aspirational, sensory
- **B2B Services** — Authoritative, measured, credible
- **Personal Creator** — Authentic, opinionated, energetic

## Testing

```bash
npm test        # 96 tests, 8 files
npm run build   # TypeScript check
```

## Security

- **BYOK** — Your keys, your data, your server
- **Optional Auth** — JWT with user-isolated brands
- **Rate Limiting** — Express rate limiter
- **Zero Telemetry** — No tracking, no phone-home
- **Docker Ready** — Isolated container deployment

## Docs

- [Getting Started](docs/guides/getting-started.md)
- [Social Publishing Setup](docs/guides/social-publishing-setup.md)
- [Parallel Dev Plan](docs/PARALLEL-DEV-PLAN.md)

---

**License:** MIT | Built by [SINT](https://sint.gg) — AI That Executes.
