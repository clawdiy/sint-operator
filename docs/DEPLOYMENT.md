# Deployment Guide

## Quick Start (Development)

```bash
git clone https://github.com/clawdiy/sint-operator.git
cd sint-operator
npm install
cp .env.example .env
# Edit .env with API keys
npm run dev
```

## Docker Compose (Production)

```bash
# Configure
cp .env.example .env
# Edit .env with API keys

# Launch
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f gateway
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| gateway | 18789 | Main API + orchestrator |
| chromadb | 8000 | Vector memory store |
| sandbox | — | Isolated execution (no network) |

## Electron Launcher

The Electron app is a thin wrapper that:
1. Checks Docker Desktop is running
2. Runs `docker-compose up -d`
3. Opens localhost:18789 in embedded Chromium
4. Provides system tray icon for status/quick actions

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | — | OpenAI/compatible API key |
| `ANTHROPIC_API_KEY` | No | — | Direct Anthropic API key |
| `OPENAI_BASE_URL` | No | — | Custom API base URL |
| `SINT_MODEL_COMPLEX` | No | `claude-opus-4-6` | Complex task model |
| `SINT_MODEL_ROUTINE` | No | `claude-sonnet-4-5` | Routine task model |
| `SINT_MODEL_FALLBACK` | No | `kimi-k2.5` | Fallback model |
| `SINT_PORT` | No | `18789` | API port |
| `SINT_DATA_DIR` | No | `./data` | Data directory |
| `SINT_CONFIG_DIR` | No | `./config` | Config directory |

## Usage Limits

Set via API or config:

```bash
# Set daily cost limit
curl -X POST http://localhost:18789/api/usage/limits \
  -H "Content-Type: application/json" \
  -d '{"daily": 100, "monthly": 2000, "perRun": 50}'
```

## Security Checklist

- [ ] API keys in `.env` (never committed)
- [ ] Command allowlist reviewed (`config/allowlist.yaml`)
- [ ] Network allowlist configured
- [ ] Approval gates enabled for publishing
- [ ] Docker sandbox running without host network
- [ ] Usage limits configured
