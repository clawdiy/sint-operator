# Lane 3: Integrations — Status

## Done
- [x] GitHub Actions CI (`.github/workflows/ci.yml`) — build + test + type check + UI build on push/PR
- [x] Twitter/X client (`src/services/social/twitter.ts`) — OAuth 1.0a, post tweet, post thread, delete tweet
- [x] LinkedIn client (`src/services/social/linkedin.ts`) — OAuth 2.0, post update, post article share, token verify
- [x] Social publishing manager (`src/services/social/index.ts`) — unified publish interface, multi-platform, queue system
- [x] Publish API routes (`src/api/publish-routes.ts`) — 7 endpoints mounted at `/api/publish/*`
- [x] Wired publish routes into main server
- [x] 7 content deliverables in `docs/content-deliverables/`

## New API Endpoints
```
POST   /api/publish           — Publish to single platform
POST   /api/publish/multi     — Publish to multiple platforms
POST   /api/publish/queue     — Add to publish queue
POST   /api/publish/process   — Process pending queue items
GET    /api/publish/queue     — Get queue items (filter: ?status=pending&brandId=xxx)
DELETE /api/publish/queue/:id — Cancel queued item
GET    /api/publish/status    — Check configured platforms (?verify=true to test tokens)
```

## New Env Vars
```
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_PERSON_URN=
```

## Blocked
- Nothing currently

## Next
- [ ] Skill prompt improvements (apply rewrites from deliverable 1)
- [ ] Telegram notification on pipeline complete
- [ ] MCP connector improvements
- [ ] Improve Dockerfile (multi-stage build, smaller image)
