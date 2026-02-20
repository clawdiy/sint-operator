# SINT Operator — Parallel Development Plan

## 3 Platforms, 3 Lanes, Zero Conflicts

### Current State (v0.4.0)
- **Live:** sint-operator-production.up.railway.app
- **Repo:** github.com/clawdiy/sint-operator
- **Working:** API, UI (React), 13 skills, 7 pipelines, 61 tests, Railway deploy
- **NOT working:** E2E LLM calls, auth, social publishing, file upload in prod

---

## Branch Strategy

```
main ←── stable, deployed to Railway
  ├── lane/backend-core    (Codex 5.3)
  ├── lane/frontend-ux     (Claude Code Opus 4.6)
  └── lane/integrations    (Clawd Bot / OpenClaw)
```

**Rules:**
- Each platform works ONLY on its branch
- PRs to `main` require passing `npm run build && npm test`
- Merge order: backend → frontend → integrations (resolve conflicts in that order)
- Sync point: merge all lanes to main every 4-6 hours of work

---

## Lane 1: BACKEND CORE — Codex 5.3

**Why Codex:** Best at deep logic, refactoring, test-heavy backend work.

**Branch:** `lane/backend-core`

**Scope — files owned:**
- `src/core/**` (pipeline engine, brand manager, memory, metering)
- `src/services/**` (LLM router, tools, whisper)
- `src/security/**`
- `src/auth/**`
- `src/api/auth-routes.ts`
- `src/orchestrator/**`
- `tests/**`
- `pipelines/**` (YAML configs)

**Tasks (Phase 1 priority):**

### 1.1 Make LLM Calls Work E2E
- [ ] Wire real API key flow (env var `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`)
- [ ] Fix LLM router — test with real calls (Anthropic Claude, OpenAI)
- [ ] Handle streaming responses from LLM
- [ ] JSON parsing resilience (LLMs return markdown-wrapped JSON sometimes)
- [ ] Timeout handling (30-60s pipelines)
- [ ] Retry logic with exponential backoff

### 1.2 Pipeline Engine Hardening
- [ ] E2E test: paste blog post → get Twitter + LinkedIn + IG output
- [ ] E2E test: topic → SEO blog article
- [ ] E2E test: 7-day content calendar generation
- [ ] Fix any prompt formatting issues discovered during testing
- [ ] Add pipeline execution timeout + cancellation

### 1.3 Auth System
- [ ] JWT auth (signup/login/refresh)
- [ ] API key management per user (BYOK model)
- [ ] Session management
- [ ] Protect all API routes (middleware)
- [ ] Rate limiting per user

### 1.4 Multi-Tenancy Foundation
- [ ] User → Brand ownership mapping
- [ ] Isolated metering per user
- [ ] Per-user usage limits

**Deliverable:** Backend that actually generates real content, with auth.

---

## Lane 2: FRONTEND UX — Claude Code Opus 4.6

**Why Claude Code:** Excellent at UI/UX, component design, styling, and holistic product thinking.

**Branch:** `lane/frontend-ux`

**Scope — files owned:**
- `src/ui/**` (all React components, styles, api client)
- `vite.config.ts`

**Tasks (Phase 1 priority):**

### 2.1 Onboarding Flow
- [ ] First-run wizard: add API key → create first brand → run first pipeline
- [ ] Settings page for API key management
- [ ] Login/signup screens (connect to auth API from Lane 1)

### 2.2 Pipeline Runner UX
- [ ] Better input forms per pipeline type (content repurpose, SEO blog, calendar)
- [ ] Loading states with progress indicators (not just spinner)
- [ ] Streaming output display (show content as it generates)
- [ ] Cancel button for long-running pipelines

### 2.3 Results & Output
- [ ] Formatted output viewer — platform-specific previews (tweet card, LinkedIn post, etc.)
- [ ] Copy-to-clipboard per output block
- [ ] Download as markdown/text
- [ ] History of past runs with search

### 2.4 Polish
- [ ] Mobile responsive (must work on phone)
- [ ] Error states that help ("API key invalid" not "500 error")
- [ ] Toast notifications for async ops
- [ ] Keyboard shortcuts (Cmd+Enter to run, etc.)
- [ ] Dark/light theme toggle

### 2.5 Brand Management
- [ ] Brand create/edit with full voice configuration
- [ ] Brand voice preview (generate sample content with current settings)
- [ ] Brand logo/avatar upload

**Deliverable:** UI that feels like a real product, not a hackathon demo.

---

## Lane 3: INTEGRATIONS — Clawd Bot (OpenClaw)

**Why Clawd:** Best at orchestration, external APIs, testing, deployment, and glue work.

**Branch:** `lane/integrations`

**Scope — files owned:**
- `src/integrations/**` (Eliza bridge, MCP connector)
- `src/skills/**/index.ts` (skill implementation improvements)
- `src/services/social/**` (social publishing — new)
- `Dockerfile`, `docker-compose.yml`, `railway.toml`
- `docs/**`
- `.github/**` (CI/CD)

**Tasks (Phase 1 priority):**

### 3.1 Social Publishing (Real)
- [ ] Twitter/X API integration (post tweets, threads)
- [ ] LinkedIn API integration (post updates)
- [ ] Instagram stub (via Meta Graph API — manual approval needed)
- [ ] Publishing queue: schedule posts, preview before send
- [ ] One-click publish from results page

### 3.2 CI/CD & DevOps
- [ ] GitHub Actions: build + test on PR
- [ ] Auto-deploy to Railway on merge to main
- [ ] Environment variable management (Railway secrets)
- [ ] Health check endpoint improvements
- [ ] Proper logging (structured, with request IDs)

### 3.3 Skill Improvements
- [ ] Improve prompt quality for each skill (test output, refine)
- [ ] Add skill: Instagram Reels caption writer
- [ ] Add skill: Newsletter generator
- [ ] Add skill: Competitor content analyzer
- [ ] Skill testing framework (input → expected output shape)

### 3.4 Eliza / MCP Bridge
- [ ] Make Eliza bridge functional (connect to Eliza runtime)
- [ ] MCP connector: expose skills as MCP tools
- [ ] Telegram notification when pipeline completes

**Deliverable:** Product that connects to the real world — publishes, deploys, integrates.

---

## Sync Protocol

### Before Starting
Each platform:
1. `git checkout main && git pull`
2. `git checkout -b lane/<name>`
3. Read this doc for scope boundaries
4. **Do not touch files outside your scope**

### Every Sync Point (every 4-6h of work)
1. Each lane: push branch, open PR to main
2. Merge order: backend → frontend → integrations
3. Resolve conflicts in the merging branch (not main)
4. Run `npm run build && npm test` after each merge
5. Deploy to Railway after all 3 merged
6. Tag release (v0.5.0, v0.6.0, etc.)

### Communication
- Each lane writes a `STATUS.md` in their branch root with:
  - What's done
  - What's blocked
  - What interface changes were made (new API endpoints, new env vars, etc.)
- **Critical:** If Lane 1 adds/changes an API endpoint, document it in `STATUS.md` so Lane 2 can consume it

---

## Interface Contracts (Don't Break These)

### API Endpoints (Backend → Frontend)
```
GET    /api/health
GET    /api/skills
GET    /api/brands
POST   /api/brands
GET    /api/brands/:id
PUT    /api/brands/:id
DELETE /api/brands/:id
GET    /api/pipelines
POST   /api/pipelines/:id/run
GET    /api/runs
GET    /api/runs/:id
GET    /api/usage
POST   /api/auth/login        ← NEW (Lane 1)
POST   /api/auth/signup       ← NEW (Lane 1)
POST   /api/auth/refresh      ← NEW (Lane 1)
POST   /api/publish/:runId    ← NEW (Lane 3)
```

### Env Vars
```
PORT=18789
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
JWT_SECRET=              ← NEW (Lane 1)
TWITTER_API_KEY=         ← NEW (Lane 3)
TWITTER_API_SECRET=      ← NEW (Lane 3)
LINKEDIN_ACCESS_TOKEN=   ← NEW (Lane 3)
```

---

## Timeline

| Day | Backend (Codex) | Frontend (Claude Code) | Integrations (Clawd) |
|-----|----------------|----------------------|---------------------|
| 1 | LLM E2E + fix router | Onboarding wizard + settings | CI/CD + GitHub Actions |
| 2 | Pipeline E2E tests | Pipeline runner UX | Social API stubs |
| 3 | Auth system (JWT) | Login/signup screens | Twitter integration |
| 4 | Multi-tenancy | Results viewer + history | LinkedIn integration |
| 5 | **SYNC** — merge all, deploy v0.5.0, test E2E together | | |
| 6 | Rate limiting + hardening | Mobile responsive + polish | Publishing queue |
| 7 | Streaming responses | Streaming UI display | Skill improvements |
| 8 | Load testing + fixes | Theme toggle + KB shortcuts | MCP + Telegram notifs |
| 9 | **SYNC** — merge all, deploy v0.6.0, full E2E validation | | |
| 10 | Bug fixes + docs | Bug fixes + polish | Deploy final + docs |

---

## Prompt Templates

### For Codex 5.3
```
You are working on github.com/clawdiy/sint-operator, branch lane/backend-core.
Your scope: src/core/**, src/services/**, src/security/**, src/auth/**, src/api/auth-routes.ts, src/orchestrator/**, tests/**, pipelines/**
DO NOT modify files in src/ui/**, src/integrations/**, src/skills/**, docs/**, Dockerfile, or CI configs.
Read docs/PARALLEL-DEV-PLAN.md for full context.
Current priority: [PASTE CURRENT TASK]
```

### For Claude Code Opus 4.6
```
You are working on github.com/clawdiy/sint-operator, branch lane/frontend-ux.
Your scope: src/ui/**, vite.config.ts
DO NOT modify files in src/core/**, src/services/**, src/api/**, src/integrations/**, src/skills/**, or backend configs.
Read docs/PARALLEL-DEV-PLAN.md for full context.
Current priority: [PASTE CURRENT TASK]
```

### For Clawd Bot (OpenClaw)
```
You are working on github.com/clawdiy/sint-operator, branch lane/integrations.
Your scope: src/integrations/**, src/skills/**/index.ts, src/services/social/**, Dockerfile, docker-compose.yml, railway.toml, docs/**, .github/**
DO NOT modify files in src/core/**, src/ui/**, src/api/server.ts, or src/auth/**.
Read docs/PARALLEL-DEV-PLAN.md for full context.
Current priority: [PASTE CURRENT TASK]
```

---

## Success Criteria (v0.5.0 — Day 5)
- [ ] Can paste content → get real LLM-generated output for 3+ platforms
- [ ] Can log in, manage API keys
- [ ] UI has onboarding flow + improved pipeline runner
- [ ] CI/CD running on GitHub Actions
- [ ] At least 1 social platform publishing works

## Success Criteria (v0.6.0 — Day 9)
- [ ] Full auth + multi-user working
- [ ] Mobile-responsive UI with streaming output
- [ ] Twitter + LinkedIn publishing live
- [ ] 70+ tests passing
- [ ] Production-ready deployment with proper logging
