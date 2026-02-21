# SINT Marketing Operator — UX Redesign Plan

## Current State: Developer Tool. Goal: Marketing Tool.

The app works end-to-end but is built for developers, not marketers. A marketing manager would:
- Not understand YAML pipelines
- Not know what "CU" or "tokens" mean
- Want to SEE their content, not read JSON
- Want to click "Post to Twitter" not configure OAuth env vars
- Want to drag a video in and get back posts, not think about "asset ingestion"

## What's Missing (Priority Order)

### 1. Content Preview & Editor (HIGH)
**Current:** Pipeline output is raw JSON in a code block.
**Need:** Rich preview showing how the post will look ON each platform.
- Twitter preview card (character count, thread view)
- LinkedIn preview (post format, article preview)
- Instagram preview (caption + image placeholder)
- Blog preview (rendered markdown, SEO score badge)
- **Edit inline** before publishing — fix typos, adjust tone, swap hashtags
- Copy individual posts, not the whole JSON blob

### 2. Social Account Connection (HIGH)
**Current:** Requires setting env vars manually (TWITTER_API_KEY etc.)
**Need:** In-app OAuth flow:
- Settings page → "Connect Twitter" button → OAuth redirect → connected ✅
- Settings page → "Connect LinkedIn" button → OAuth redirect → connected ✅
- Show connected accounts with avatar, handle, status
- "Disconnect" option
- For now: at minimum, a guided setup that tells you exactly what to paste

### 3. Visual Pipeline Builder (MEDIUM)
**Current:** Select pipeline from list, fill form inputs, get JSON back.
**Need:** Visual flow showing steps:
- Pipeline steps as connected cards (Step 1 → Step 2 → Step 3)
- Each step shows: skill name, description, input/output preview
- Progress animation during execution (step lights up as it runs)
- Output preview at each step, not just final

### 4. One-Click Publish from Results (HIGH)
**Current:** Results show raw JSON. No way to publish.
**Need:** After pipeline completes:
- Each deliverable has a "Post" button
- Shows which accounts are connected
- Click → posts immediately or adds to queue
- Confirmation: "Posted to @sinthive — View post ↗"

### 5. File Upload Integration in Pipelines (MEDIUM)
**Current:** Upload page exists separately from pipelines.
**Need:** When a pipeline input expects a file (content, video):
- Show a file drop zone inline in the pipeline form
- Or let user select from previously uploaded assets
- Show preview of the uploaded content

### 6. Human-Readable Labels (LOW but important)
- "CU" → "Credits" or just remove
- "Tokens Used" → "AI Words Processed" or hide entirely
- Pipeline IDs like "content-repurpose" → "Content Repurposer"
- "sint-brand" → just "SINT"
- Status badges: "queued" → "Starting...", "running" → "Generating..."

### 7. Results Page Redesign (HIGH)
- Group by run, not flat list
- Show deliverables as cards, not JSON
- Platform-specific formatting
- Export as formatted document, not raw JSON
- "Use this" / "Discard" workflow

## Implementation Priority

### Phase 1 — Make Results Usable (this sprint)
1. Content preview cards in Results (platform-specific)
2. Edit-before-publish inline editor
3. One-click copy per deliverable
4. Publish button (connects to existing /api/publish)

### Phase 2 — Social Connections
1. Settings: account connection UI with guided setup
2. OAuth flows for Twitter + LinkedIn
3. Connected account display with status
4. Publish queue management UI

### Phase 3 — Visual Pipeline
1. Pipeline step visualization
2. Live step progress during execution
3. Per-step output preview
4. File upload in pipeline inputs

### Phase 4 — Polish
1. Human-readable labels everywhere
2. Mobile responsive
3. Tutorial/tooltips for first-time users
4. Keyboard shortcuts
