# Lane 3: Integrations — Status

## Done ✅
- [x] GitHub Actions CI — build + test + type check on push/PR
- [x] Twitter/X client — OAuth 1.0a, tweets, threads, delete
- [x] LinkedIn client — OAuth 2.0, posts, articles, token verify
- [x] Social publishing manager — unified interface, queue, multi-platform
- [x] Publish API routes — 7 endpoints at `/api/publish/*`
- [x] 7 content deliverables in `docs/content-deliverables/`
- [x] All 8 skill prompts rewritten
- [x] 4 template brands (SaaS, E-commerce, B2B, Creator)
- [x] Multi-stage Dockerfile + docker-compose
- [x] Newsletter Generator skill (NEW)
- [x] Competitor Content Analyzer skill (NEW)
- [x] Telegram notification service (pipeline complete alerts)
- [x] MCP Skill Server — exposes all 15 skills as MCP tools
- [x] Generic `runSkill()` method on Orchestrator
- [x] README updated

## New API Endpoints
```
POST   /api/publish           — Publish to single platform
POST   /api/publish/multi     — Publish to multiple platforms
POST   /api/publish/queue     — Add to publish queue
POST   /api/publish/process   — Process pending queue items
GET    /api/publish/queue     — Get queue items
DELETE /api/publish/queue/:id — Cancel queued item
GET    /api/publish/status    — Check configured platforms
GET    /mcp/tools             — List MCP tools (skill discovery)
POST   /mcp/tools/call        — Call MCP tool (skill execution)
GET    /mcp/health            — MCP health check
```

## New Env Vars
```
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_PERSON_URN=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
DASHBOARD_URL=
JWT_SECRET=
```

## Stats
- 15 skills (was 13)
- 7 pipelines
- 10 new API endpoints
- Social publishing: Twitter + LinkedIn
- MCP: all skills exposed as tools
