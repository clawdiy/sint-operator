# SINT Operator — Production Roadmap

## Current State (v0.5.0)
- ✅ 7 pipelines (ad-variations, brand-identity, content-repurpose, infographic, seo-blog, social-calendar, visual-metadata)
- ✅ 15 skills (content-analyzer, content-repurpose, seo-blog, social-calendar, video-clipper, linkedin-writer, etc.)
- ✅ LLM Router (OpenAI + Anthropic with model tier routing)
- ✅ Auth (JWT signup/login)
- ✅ React dashboard UI
- ✅ Social publishing (LinkedIn, Twitter with queue/retry)
- ✅ Asset upload + processing (FFmpeg, Sharp, Whisper)
- ✅ Pipeline engine (YAML-based, step chaining, parallel exec, retry)
- ✅ Usage metering & limits
- ✅ MCP connector (stub)
- ✅ Webhook system
- ✅ SSE streaming for pipeline runs
- ✅ OpenAPI spec

## Phase 1 — Core Integrations (v0.6.0) 🔥
### Messaging (Telegram + WhatsApp)
- [ ] Telegram Bot integration — receive commands, send results, inline approval
- [ ] WhatsApp Business API — same flow
- [ ] Conversation context per user
- [ ] "Upload video → get content" flow via chat

### Image Generation
- [ ] OpenAI DALL-E 3 / gpt-image-1 integration
- [ ] Infographic generation (data → visual)
- [ ] Ad creative generation (product photo + brand → variations)
- [ ] Social card generation (enhanced Sharp + AI)

### Video Generation
- [ ] Short-form clip extraction (existing video-clipper skill)
- [ ] Caption burning (FFmpeg ASS/SRT overlay)
- [ ] Runway/Kling/Minimax API for AI video gen
- [ ] Auto-resize for platform specs (9:16, 1:1, 16:9)

### Content Approval Workflow
- [ ] Draft → Review → Approved → Published states
- [ ] Approval UI in dashboard
- [ ] Telegram/WhatsApp approval buttons
- [ ] Batch approve/reject
- [ ] Edit before publish

## Phase 2 — AI & External Integrations (v0.7.0)
### Additional AI Providers
- [ ] Google Gemini API
- [ ] Stability AI (image gen)
- [ ] ElevenLabs (voice/audio)
- [ ] Perplexity API (research)

### NanoBanana Integration
- [ ] GPU-accelerated image/video gen via Banana.dev API
- [ ] Queue management for long-running gen tasks
- [ ] Webhook callbacks on completion

### OpenClaw Integration
- [ ] Webhook endpoint for OpenClaw → SINT commands
- [ ] API key auth for OpenClaw agents
- [ ] Pipeline trigger via natural language
- [ ] Results delivery back to OpenClaw session

### OAuth Integrations
- [ ] Google Workspace (Drive, Docs, Sheets)
- [ ] Meta Business (Facebook, Instagram publishing)
- [ ] LinkedIn OAuth (replace manual token)
- [ ] Twitter OAuth 2.0 (replace manual tokens)
- [ ] Shopify (product image metadata)
- [ ] HubSpot CRM
- [ ] Canva API (design templates)

## Phase 3 — Enterprise Ready (v0.8.0)
### Multi-tenant
- [ ] Workspace/org model
- [ ] Team roles (admin, editor, viewer)
- [ ] Per-workspace billing
- [ ] White-label option

### Analytics & Reporting
- [ ] Post-publish analytics (engagement tracking)
- [ ] A/B test tracking for ad variations
- [ ] ROI dashboard
- [ ] Automated weekly reports

### Advanced Pipelines
- [ ] Conditional branching (if engagement > X, boost)
- [ ] Human-in-the-loop steps
- [ ] Pipeline marketplace (share/import pipelines)
- [ ] Custom skill builder (no-code)

## Pipeline Coverage vs Client Needs

| Client Need | Pipeline | Status |
|------------|----------|--------|
| Content Repurposing (video → clips + posts + blog) | content-repurpose | ✅ Pipeline exists, needs image/video gen |
| Infographic Creation | infographic | ✅ Pipeline exists, needs image gen |
| Creative Ad Variations | ad-variations | ✅ Pipeline exists, needs image gen |
| Content Calendar | social-calendar | ✅ Pipeline exists |
| Brand Identity Package | brand-identity | ✅ Pipeline exists, needs image gen for logos |
| SEO Visual Metadata | visual-metadata | ✅ Pipeline exists |
| SEO Blog Post | seo-blog | ✅ Pipeline exists |

**Key blocker: Image/video generation is the #1 missing piece across 4/7 pipelines.**
