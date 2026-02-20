# ─── Stage 1: Build ──────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npx tsc
RUN npm run ui:build || true
RUN cp -r src/ui/dist dist/ui-static 2>/dev/null || true

# ─── Stage 2: Production ─────────────────────────────────────
FROM node:22-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/ui/dist ./dist/ui-static
COPY config ./config

EXPOSE 18789

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:18789/api/health || exit 1

CMD ["node", "dist/index.js"]
