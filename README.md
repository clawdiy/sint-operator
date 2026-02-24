# 🤖 SINT — AI Marketing That Executes

![Version](https://img.shields.io/badge/version-0.6.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-22%2B-brightgreen)

## What is SINT?

SINT is an autonomous marketing AI operator that turns raw assets — images, text, ideas — into platform-ready content across every major social channel. It doesn't just suggest; it researches, writes, designs, schedules, and publishes. One pipeline in, finished content out.

## Features

- 🎯 **Social Media Pipeline** — Generate platform-optimized posts for Twitter, LinkedIn, Instagram, and TikTok
- 📝 **Blog Pipeline** — Long-form content creation with SEO optimization
- 🎨 **Visual Pipeline** — Image generation and editing with AI
- 📧 **Email Pipeline** — Campaign copy and newsletter generation
- 📊 **Analytics Pipeline** — Performance tracking and content scoring
- 🔄 **Repurpose Pipeline** — Transform content across formats and platforms
- 🚀 **Campaign Pipeline** — End-to-end multi-channel campaign orchestration

## Quick Start

### Docker

```bash
docker pull ghcr.io/sint-operator/sint:latest
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  -e AUTH_ENABLED=false \
  ghcr.io/sint-operator/sint:latest
```

### Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)

Set required environment variables in your Railway dashboard (see Configuration below).

### Manual

```bash
git clone https://github.com/sint-operator/sint-operator.git
cd sint-operator
npm install
npm run build
npm start
```

Open `http://localhost:3000` in your browser.

## API Reference

Interactive API docs available at `/api/docs` when the server is running.

**Key endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/pipelines` | List available pipelines |
| `POST` | `/api/pipelines/:id/run` | Execute a pipeline |
| `GET` | `/api/runs` | List pipeline runs |
| `GET` | `/api/runs/:id` | Get run details |
| `GET` | `/api/brands` | List configured brands |
| `POST` | `/api/content/generate` | Generate content directly |
| `GET` | `/api/health` | Health check |

## Architecture

```
Request → Pipeline Engine → Skills → LLM Router → Publishing
                ↓               ↓          ↓
           Scheduling      Templates   OpenAI / Anthropic / Local
```

The **Pipeline Engine** orchestrates multi-step workflows. Each step invokes **Skills** (research, write, design, publish). The **LLM Router** selects the best model for each task based on cost, speed, and quality requirements.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key for content generation |
| `ANTHROPIC_API_KEY` | No | — | Anthropic API key (optional LLM) |
| `AUTH_ENABLED` | No | `false` | Enable authentication |
| `AUTH_SECRET` | If auth | — | JWT secret for auth |
| `TELEGRAM_BOT_TOKEN` | No | — | Telegram bot integration |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `BRAND_DIR` | No | `config/brands` | Brand config directory |

## Development

```bash
npm install          # Install dependencies
npm run dev          # Dev server with hot reload
npm run build        # Production build
npm start            # Start production server
npm test             # Run tests
```

## License

MIT © SINT Operator
