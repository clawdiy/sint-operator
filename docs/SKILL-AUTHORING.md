# Skill Authoring Guide

## Skill Manifest Standard

Every marketing capability is packaged as a Skill following the Agent Skills open standard with SINT extensions.

### SKILL.md Format

```yaml
---
name: content-repurposing
description: >
  Takes a long-form video or article and generates platform-specific
  content pieces.
  Triggers: "repurpose", "shred content", "turn video into posts"
version: 1.0.0
capabilities:
  - fs.uploads.read
  - fs.outputs.write
  - ffmpeg.exec
  - whisper.transcribe
  - ai.claude-sonnet.invoke
allowed-tools:
  - ffmpeg
  - python
  - node
memory-scope: shared
cost-units: 15
---

# Content Repurposing Skill

## Workflow
1. Ingest asset (video/article/text)
2. Extract and transcribe
3. Analyze for hooks and themes
4. Generate platform-specific outputs
5. Package deliverables
```

### Progressive Disclosure Levels

| Level | What Loads | Token Cost | When |
|-------|-----------|-----------|------|
| L1: Discovery | Frontmatter only | ~75 tokens | Startup |
| L2: Activation | Full SKILL.md body | ~2-5K tokens | Task match |
| L3: Resources | scripts/, templates/, assets/ | Variable | Execution |

### Skill Directory Structure

```
skills/my-skill/
├── SKILL.md              # Manifest + documentation
├── index.ts              # Skill implementation
├── scripts/              # Automation scripts
│   ├── process.py
│   └── transform.sh
├── templates/            # Output templates
│   └── report.html
└── assets/               # Reference materials
    └── examples.json
```

## Implementing a Skill

```typescript
import { buildBrandContext } from '../../core/brand/manager.js';
import type { Skill, SkillContext, SkillResult } from '../../core/types.js';

export const mySkill: Skill = {
  id: 'my-skill',
  name: 'My Skill',
  description: 'What this skill does',
  version: '1.0.0',
  costUnits: 10,
  inputs: [
    { name: 'text', type: 'string', required: true, description: 'Input text' },
  ],
  outputs: [
    { name: 'result', type: 'object', description: 'Output data' },
  ],

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const text = ctx.inputs.text as string;
    const brandContext = buildBrandContext(ctx.brand);

    // Use LLM with appropriate tier
    const result = await ctx.llm.complete(
      `${brandContext}\n\n${text}`,
      { tier: 'routine' }  // or 'complex' for heavy tasks
    );

    return {
      output: { result: result.text },
      tokensUsed: result.meta.totalTokens,
      costUnits: result.meta.costUnits,
      modelUsed: result.meta.model,
      durationMs: Date.now() - start,
    };
  },
};
```

## Capabilities Reference

| Capability | Description |
|-----------|-------------|
| `fs.uploads.read` | Read uploaded files |
| `fs.outputs.write` | Write to output directory |
| `ffmpeg.exec` | Execute FFmpeg commands |
| `sharp.exec` | Image processing |
| `playwright.exec` | Browser automation |
| `whisper.transcribe` | Audio transcription |
| `ai.claude-opus.invoke` | Use Claude Opus |
| `ai.claude-sonnet.invoke` | Use Claude Sonnet |
| `ai.stability.invoke` | Use Stability AI |
| `network.api` | Make API calls |
| `network.scrape` | Web scraping |
| `brand.read` | Read brand profiles |
| `memory.read` | Read memory store |
| `memory.write` | Write to memory store |

## Cost Units

Cost units represent relative resource consumption:

| Operation | Typical Cost |
|-----------|-------------|
| Simple formatting | 2-3 units |
| Content generation | 10-15 units |
| Multi-step analysis | 15-25 units |
| Video processing | 20-30 units |
| Full pipeline | 30-80 units |
