# ─── Stage 1: Build ──────────────────────────────────────────
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# cache-bust: v2
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Build backend TypeScript
RUN npx tsc --skipLibCheck || echo "⚠️ TSC failed but continuing"

# Backup fallback UI before vite (emptyOutDir wipes src/ui/dist/)
RUN cp -r src/ui/dist /tmp/ui-fallback 2>/dev/null || true

# Build UI (Vite)
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN CI=true npm run ui:build 2>&1 || echo "⚠️ Vite build failed, using fallback"

# Ensure ui-static exists -- use vite output or fallback
RUN mkdir -p dist/ui-static && \
    if [ -f src/ui/dist/index.html ]; then \
      cp -r src/ui/dist/* dist/ui-static/; \
    elif [ -f /tmp/ui-fallback/index.html ]; then \
      echo "Using fallback UI"; \
      cp -r /tmp/ui-fallback/* dist/ui-static/; \
    else \
      echo "No UI available"; \
    fi

# ─── Stage 2: Production ─────────────────────────────────────
FROM node:22-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm install better-sqlite3

COPY --from=builder /app/dist ./dist
COPY config ./config
COPY docs ./docs

RUN mkdir -p data

EXPOSE 18789

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:18789/health || exit 1

CMD ["node", "dist/index.js"]
