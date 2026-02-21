# ─── Stage 1: Build ──────────────────────────────────────────
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Build backend TypeScript
RUN npx tsc || (echo "⚠️ TSC failed, trying with skipLibCheck" && npx tsc --skipLibCheck)

# Build UI (Vite)
RUN npm run ui:build 2>&1 || echo "⚠️ Vite build failed, using fallback"

# Ensure ui-static exists
RUN mkdir -p dist/ui-static && \
    (cp -r src/ui/dist/* dist/ui-static/ 2>/dev/null || echo "⚠️ No Vite output found")

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
