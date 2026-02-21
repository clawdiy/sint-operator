# Changelog

## [0.5.0] - 2026-02-21

### Added
- **Dual LLM Support** — Native Anthropic SDK + OpenAI SDK with automatic model routing
- **Content Preview System** — Platform-specific preview cards (Twitter, LinkedIn, Blog, Calendar)
- **Social Account Connection** — Guided setup for Twitter OAuth + LinkedIn OAuth in Settings
- **Visual Pipeline Steps** — Step-by-step flow visualization with live progress
- **Notification System** — Bell icon with badge, SSE real-time updates, unread count
- **Onboarding Wizard** — 3-step setup flow for first-time users
- **SQLite Run Persistence** — Runs survive server restarts
- **OpenAPI/Swagger** — Full spec at /api/docs with Swagger UI
- **MCP Skill Server** — All 15 skills exposed as MCP tools
- **Social Publishing** — Twitter/X + LinkedIn with queue system
- **Telegram Notifications** — Pipeline completion alerts
- **2 New Skills** — Newsletter generator, competitor content analyzer
- **4 Template Brands** — SaaS, E-commerce, B2B, Personal Creator
- **CI/CD Pipeline** — GitHub Actions (build + test + type check)
- **Delete Runs** — DELETE /api/runs/:id endpoint
- **Publish Buttons** — One-click publishing from content preview
- **Inline Editing** — Edit generated content before publishing
- **Keyboard Shortcuts** — Cmd+Enter for quick actions
- **Error Boundary** — Graceful crash handling

### Changed
- Pipeline runner opens as modal popup (not inline)
- Brand create/detail views as modal popups
- Results page: split layout (list left, detail right)
- Sidebar: expandable with text labels, collapsed with tooltips
- Friendly pipeline names everywhere ("Content Repurposer" not "content-repurpose")
- Brand template names shown as descriptive titles
- "Tokens" → "AI Calls", "CU" → "Credits"
- Skills page: icons, search, alphabetical sort
- Auto-navigate to Results after pipeline completion

### Fixed
- Auth blocking UI when AUTH_ENABLED not set
- Brand lookup failing in auth-disabled mode
- Model name format for Anthropic API
- Dockerfile: build tools for native modules, health check path
- TSConfig: include onboarding + notifications in build

### Infrastructure
- Multi-stage Dockerfile with health checks
- Railway deployment with volume persistence notes
- Docker Compose for local development
- Better error logging in Docker builds

## [0.4.0] - 2026-02-20

### Added
- Initial SINT Marketing Operator
- 13 skills, 7 pipelines, basic brand system
- React SPA with dark theme
- Express API server
- LLM router (OpenAI only)
