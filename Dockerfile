FROM node:22-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install ALL deps (including devDeps for tsc build)
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npx tsc

# Prune devDeps after build
RUN npm prune --production

EXPOSE 18789

CMD ["node", "dist/index.js"]
