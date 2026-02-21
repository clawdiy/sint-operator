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
# or
docker build -t sint-operator .
docker run -p 18789:18789 --env-file .env sint-operator
```

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)

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

The router automatically selects models based on task complexity:

| Tier | Default Model | Use Case | Timeout |
|------|--------------|----------|---------|
| Complex | `claude-opus-4-6` | Strategy, analysis, long-form | 60s |
| Routine | `claude-sonnet-4-5` | Formatting, short-form | 30s |
| Fallback | `kimi-k2.5` | Rate limit overflow | 30s |

Override via env vars: `SINT_MODEL_COMPLEX`, `SINT_MODEL_ROUTINE`, `SINT_MODEL_FALLBACK`.

**Dual SDK support:** Claude models → Anthropic SDK, GPT models → OpenAI SDK. Both keys can be configured via Settings UI or env vars.

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
GET  /api/runs                         List runs (filter: ?status=&pipelineId=&brandId=)
GET  /api/runs/:id                     Get run details + outputs
POST /api/runs/:id/cancel              Cancel a running pipeline
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
POST /api/publish/queue                Queue for later publishing
POST /api/publish/process              Process pending queue
GET  /api/publish/queue                List queued items
DELETE /api/publish/queue/:id          Cancel queued item
GET  /api/publish/status               Check platform configuration
```

### MCP (Model Context Protocol)
```
GET  /mcp/tools                        List all skills as MCP tools
POST /mcp/tools/call                   Execute a skill via MCP
GET  /mcp/health                       MCP server health
```

### Other
```
GET  /health                           System health + version
GET  /api/skills                       List registered skills
GET  /api/usage?days=30                Usage statistics
GET  /api/usage/current                Current session usage
GET  /api/assets                       List uploaded assets
POST /api/assets/upload                Upload asset (multipart)
POST /api/settings/api-key             Save OpenAI API key
GET  /api/settings/api-key             Check if OpenAI key is set
POST /api/settings/anthropic-key       Save Anthropic API key
GET  /api/settings/anthropic-key       Check if Anthropic key is set
GET  /api/onboarding/status            Check onboarding state
POST /api/onboarding/setup             Complete onboarding
GET  /api/notifications                List notifications
POST /api/notifications/:id/read       Mark notification read
POST /api/notifications/read-all       Mark all read
GET  /api/notifications/stream         SSE notification stream
```

## Environment Variables

```env
# Required (at least one)
OPENAI_API_KEY=sk-...                  # OpenAI API key
ANTHROPIC_API_KEY=sk-ant-...           # Anthropic API key

# Optional — Model overrides
SINT_MODEL_COMPLEX=claude-opus-4-6     # Complex task model
SINT_MODEL_ROUTINE=claude-sonnet-4-5   # Routine task model  
SINT_MODEL_FALLBACK=kimi-k2.5         # Fallback model
OPENAI_BASE_URL=                       # Custom OpenAI-compatible base URL

# Optional — Social Publishing
TWITTER_API_KEY=                       # Twitter/X OAuth 1.0a
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=
LINKEDIN_ACCESS_TOKEN=                 # LinkedIn OAuth 2.0
LINKEDIN_PERSON_URN=urn:li:person:XXX

# Optional — Notifications  
TELEGRAM_BOT_TOKEN=                    # Telegram bot for pipeline alerts
TELEGRAM_CHAT_ID=

# Optional — Auth (disabled by default)
AUTH_ENABLED=false                     # Enable JWT auth
JWT_SECRET=                            # Secret for JWT signing

# Optional — Server
PORT=18789
SINT_DATA_DIR=./data
SINT_CONFIG_DIR=./config
DASHBOARD_URL=                         # URL for notification links
```

## Template Brands

4 pre-built brand profiles in `config/brands/`:

| Template | Voice | Best For |
|----------|-------|----------|
| **SaaS Startup** | Clear, confident, problem-solution | Tech companies, B2B SaaS |
| **E-commerce / DTC** | Warm, aspirational, sensory | Product brands, lifestyle |
| **B2B Services** | Authoritative, measured, credible | Consultancies, agencies |
| **Personal Creator** | Authentic, opinionated, energetic | Founders, influencers |

Clone and customize: `cp config/brands/template-saas.yaml config/brands/my-brand.yaml`

## Testing

```bash
npm test              # Run all tests (96 tests, 8 files)
npm run build         # TypeScript compilation check
npm run lint          # ESLint
```

## Project Structure

```
sint-operator/
├── config/
│   ├── brands/           # Brand YAML profiles
│   └── pipelines/        # Pipeline YAML definitions
├── src/
│   ├── api/              # Express server, routes, SSE
│   ├── auth/             # JWT auth, API key storage
│   ├── core/
│   │   ├── brand/        # Brand manager
│   │   ├── memory/       # SQLite memory + brand store
│   │   ├── metering/     # Token/cost tracking
│   │   ├── pipeline/     # YAML pipeline engine
│   │   ├── skills/       # Skill registry
│   │   └── types.ts      # Core type definitions
│   ├── integrations/     # MCP server, Eliza bridge
│   ├── orchestrator/     # Main orchestrator
│   ├── services/
│   │   ├── llm/          # Dual LLM router (Anthropic + OpenAI)
│   │   ├── social/       # Twitter + LinkedIn clients
│   │   └── tools/        # Whisper, tool services
│   ├── skills/           # 15 skill implementations
│   └── ui/               # React SPA (Vite + TypeScript)
├── tests/                # Test suite
├── Dockerfile            # Multi-stage production build
├── docker-compose.yml
├── railway.toml          # Railway deployment config
└── package.json
```

## Security

- **BYOK Model** — You control your API keys. No data leaves your server except to your chosen LLM provider.
- **Optional Auth** — JWT authentication with user-isolated brands and API keys.
- **Rate Limiting** — Express rate limiter on all API routes.
- **No Telemetry** — Zero tracking, zero analytics, zero phone-home.
- **Docker Ready** — Run in an isolated container with no host access.

## Roadmap

- [ ] File upload for video/PDF content ingestion
- [ ] Persistent run storage (SQLite)
- [ ] Instagram and TikTok publishing
- [ ] Scheduled pipeline execution (cron)
- [ ] OpenAPI/Swagger documentation
- [ ] Approval gates for social publishing
- [ ] Webhook integrations
- [ ] Multi-user teams

---

**License:** MIT

Built by [SINT](https://sint.gg) — AI That Executes. No prompts. Just outcomes.
