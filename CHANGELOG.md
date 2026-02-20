# Changelog

All notable changes to SINT Marketing Operator are documented here.

## [0.4.0] - 2025-02-20

### Added
- **Parallel step execution** — Pipeline steps can now declare `config.parallel: true` with `config.count: N` to run N instances concurrently using Promise.all with a concurrency limit of 5.
- **Batch processing** — Steps with `config.count: N` (without parallel) execute sequentially N times with indexed inputs; outputs collected into an array.
- **Pipeline trigger matching** — New `matchPipeline(input)` and `matchAllPipelines(input)` functions match user input against pipeline `trigger.pattern` regex fields. Returns the best-scoring match.
- **Notifier skill** — New `notifier` skill formats messages from `{{variable}}` templates with channel-specific formatting (Telegram, Slack, Discord, email, webhook). Cost: 1 unit.
- **Test suite** — Comprehensive vitest test suite:
  - `pipeline-engine.test.ts` — Pipeline loading, variable resolution, condition evaluation, retry logic, parallel execution, trigger matching
  - `brand-manager.test.ts` — Brand CRUD, context building, YAML loading, platform config
  - `skill-registry.test.ts` — Skill registration, matching, progressive disclosure, execution
- **CHANGELOG.md** — This file.

### Changed
- Pipeline engine upgraded to v3 with parallel/batch support.
- Orchestrator now registers notifier skill (13 built-in skills total).
- Orchestrator exposes `matchPipeline()` and `matchAllPipelines()` methods.
- `resolveInputs`, `resolveValue`, and `evaluateCondition` are now exported for testability.

## [0.3.0] - 2025-02-15

### Added
- **Brand Identity Pipeline** — Full brand identity generation: research → colors → typography → logos → mockups → guidelines.
- **Visual Metadata Pipeline** — Automated visual asset metadata extraction and tagging.
- **Ad Variations Pipeline** — Generate multiple ad copy/creative variations for A/B testing.
- **Infographic Pipeline** — Data-driven infographic content generation.
- **SEO Optimizer skill** — On-page SEO analysis and optimization recommendations.
- **SERP Scraper skill** — Search engine results page scraping for competitive analysis.
- **Brand Researcher skill** — Deep brand research including competitor analysis and positioning.

### Changed
- Pipeline YAML schema now supports `config` field on steps for extensible step configuration.
- Model routing improved with better tier selection heuristics.

## [0.2.0] - 2025-02-01

### Added
- **Pipeline Engine v2** — Full YAML-based deterministic pipeline execution with step chaining ($ref variables), conditional execution, retry with linear/exponential backoff, model tier routing per step, and audit trail.
- **Metering system** — SQLite WAL-mode usage tracking with daily/monthly/per-run cost limits and hard stops.
- **Progressive skill discovery** — Three-level loading system (L1: Discovery ~75 tokens, L2: Activation ~2-5K tokens, L3: Resources on-demand) for context window efficiency.
- **Brand Context Manager** — Brand profile CRUD with YAML persistence, voice/visual/platform config, and automatic system prompt injection.
- **12 built-in skills:**
  - `asset-ingester` — File/URL/text ingestion with metadata extraction
  - `content-analyzer` — Theme identification, hook extraction, platform suitability scoring
  - `content-repurpose` — Multi-platform content generation from long-form source
  - `seo-blog` — SEO-optimized blog article generation
  - `social-calendar` — Social media content calendar generation
  - `platform-formatter` — Platform-specific formatting and constraint enforcement
  - `video-clipper` — Video clip extraction with FFmpeg
  - `linkedin-writer` — LinkedIn-optimized professional content
  - `output-packager` — Final deliverable packaging
  - `brand-researcher` — Brand research and competitive analysis
  - `serp-scraper` — SERP data collection
  - `seo-optimizer` — SEO analysis and recommendations
- **Memory store** — ChromaDB-backed vector memory with semantic search.
- **LLM Router** — Tiered model routing (complex/routine/fallback) with automatic fallback.
- **API server** — Express-based REST API for pipeline execution, brand management, and asset operations.
- **CLI** — Commander-based CLI for pipeline execution and management.

### Changed
- Full architecture rewrite from v0.1.0 proof-of-concept.

## [0.1.0] - 2025-01-15

### Added
- Initial proof-of-concept.
- Basic content repurposing from text input.
- Single-model LLM integration.
- Simple file-based storage.
- Content Repurpose Pipeline (basic version).
- Social Calendar Pipeline (basic version).
- SEO Blog Pipeline (basic version).
