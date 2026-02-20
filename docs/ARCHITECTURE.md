# SINT Marketing Operator — Architecture

## Overview

A locally-hosted, always-on AI agent operator purpose-built for marketing teams and agencies. Takes the OpenClaw agentic runtime + Eliza OS social intelligence layer and wraps them in a marketing-specific orchestration system.

**Core Promise:** Upload one asset → get dozens of platform-ready deliverables in 60 seconds.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                 SINT MARKETING OPERATOR                 │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │   Electron   │  │   Web UI     │  │  Telegram/    │ │
│  │   Launcher   │  │  localhost:  │  │  Slack/       │ │
│  │              │  │  18789       │  │  WhatsApp     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘ │
│         └─────────────┬───┴──────────────────┘          │
│                       │                                 │
│  ┌────────────────────┴────────────────────────────┐    │
│  │         GATEWAY DAEMON (Node.js v22+)           │    │
│  │  • Message ingress/egress                       │    │
│  │  • Session management                           │    │
│  │  • Permission enforcement                       │    │
│  │  • Guardrails-first security layer              │    │
│  └────────────────────┬────────────────────────────┘    │
│                       │                                 │
│  ┌────────────────────┴────────────────────────────┐    │
│  │         MARKETING ORCHESTRATOR                  │    │
│  │  • YAML Pipeline Engine                         │    │
│  │  • Progressive Skill Disclosure (L1/L2/L3)      │    │
│  │  • Intelligent Model Router (Opus/Sonnet/Kimi)  │    │
│  │  • Brand Context Injector                       │    │
│  │  • Asset Router (format-specific outputs)       │    │
│  └──────┬───────────────┬──────────────┬───────────┘    │
│         │               │              │                │
│  ┌──────┴───┐  ┌────────┴────┐  ┌──────┴──────────┐    │
│  │ OpenClaw │  │  Eliza OS   │  │ Tool Services   │    │
│  │ Runtime  │  │  Social     │  │                 │    │
│  │          │  │  Layer      │  │ • FFmpeg        │    │
│  │ • Brain  │  │             │  │ • Playwright    │    │
│  │ • Memory │  │ • Twitter   │  │ • Sharp/Canvas  │    │
│  │ • Sandbox│  │ • LinkedIn  │  │ • Whisper API   │    │
│  │ • Lane Q │  │ • IG/TikTok │  │ • Stability AI  │    │
│  └──────────┘  └─────────────┘  └─────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │           PERSISTENCE LAYER                     │    │
│  │  SQLite FTS5 (precision) + ChromaDB (semantic)  │    │
│  │  Brand profiles │ Usage metering │ Asset registry│    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Model Routing Strategy

| Task Type | Model | Max Tokens | Examples |
|-----------|-------|-----------|----------|
| Complex reasoning | Claude Opus 4.6 | 8192 | Brand research, content strategy, SEO blog writing |
| Routine generation | Claude Sonnet 4.5 | 4096 | LinkedIn posts, captions, formatting |
| High-volume batch | Claude Haiku 4.5 | 2048 | Image analysis, SEO scoring, data extraction |
| Fallback | Kimi-K2.5 | 4096 | Rate limit overflow |

## Progressive Skill Disclosure

| Level | What Loads | Token Cost | When |
|-------|-----------|-----------|------|
| L1: Discovery | Name + description | ~50-100 tokens | Agent startup |
| L2: Activation | Full SKILL.md body | ~2,000-5,000 tokens | Task matches skill |
| L3: Resources | Scripts, templates, assets | Variable | During execution |

50+ skills at ~5K idle token cost.

## Security Model

- **Command Allowlist**: Only approved commands (ffmpeg, node, python3, etc.)
- **Blocked Patterns**: No shell redirections, pipes, sudo, rm -rf
- **Network Allowlist**: Only approved API endpoints
- **Approval Gates**: Publishing, email, brand modification require human approval
- **Docker Sandbox**: Isolated execution, no host access

## Integration Architecture

```
OpenClaw Gateway (primary runtime)
│
├── OpenClaw Brain (reasoning + tool calling)
│   │
│   ├── SINT Skills (marketing pipelines)
│   │
│   └── Eliza OS Character Engine (brand voice)
│       │
│       ├── Twitter Client (organic posting)
│       ├── LinkedIn Client (professional content)
│       └── TikTok Client (short-form hooks)
│
└── OpenClaw Channels (input/approval)
    ├── Telegram (client communication)
    ├── Slack (team notifications)
    └── WhatsApp (client approvals)
```

## Competitive Moat

The moat is **methodology, not connectivity**:
- Any agent can connect to Twitter via MCP
- Only SINT has pre-built marketing pipelines encoding best practices
- YAML templates = domain expertise as executable workflows
- Brand memory ensures consistency one-off prompting can never achieve
- Progressive disclosure = 10x less token burn than competitors
