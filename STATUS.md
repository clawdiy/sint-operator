# SINT Marketing Operator — v0.5.0 Status

## What's Live
- ✅ 15 skills registered and operational
- ✅ 7 YAML pipelines (all referencing valid skills)
- ✅ 5 brand profiles (1 custom + 4 templates)
- ✅ Dual LLM routing (Anthropic + OpenAI with hot-reload)
- ✅ React SPA with dark theme UI
- ✅ Dashboard with 3 quick actions
- ✅ Pipeline runner with dynamic inputs
- ✅ Results viewer with platform tabs, export (MD/JSON)
- ✅ Brand manager with create/view/detail
- ✅ Settings with dual API key management
- ✅ Usage/metering dashboard
- ✅ Social publishing API (Twitter + LinkedIn)
- ✅ MCP skill server (15 skills as MCP tools)
- ✅ Telegram notifications on pipeline completion
- ✅ SSE run streaming endpoint
- ✅ Notification system with SSE
- ✅ Optional JWT auth with user isolation
- ✅ GitHub Actions CI pipeline
- ✅ Multi-stage Dockerfile + docker-compose
- ✅ Railway deployment (railway.toml)
- ✅ 96 tests across 8 files

## Deployed
- **URL:** https://sint-operator-production.up.railway.app
- **Builder:** Dockerfile (multi-stage)
- **Health:** GET /health

## API Endpoints: 30+
- 3 quick action endpoints
- 5 pipeline endpoints  
- 5 run endpoints (incl SSE stream)
- 3 brand endpoints
- 7 social publishing endpoints
- 3 MCP endpoints
- 4 settings endpoints
- 4 notification endpoints (incl SSE)
- 3 onboarding endpoints
- 2 usage endpoints
- 2 asset endpoints
- 1 health endpoint

## Tech Stack
- **Runtime:** Node.js 22 + TypeScript
- **Frontend:** React 18 + Vite
- **Backend:** Express
- **LLMs:** Anthropic SDK + OpenAI SDK
- **Storage:** SQLite (memory + metering), in-memory (runs)
- **Deploy:** Docker, Railway, GitHub Actions
