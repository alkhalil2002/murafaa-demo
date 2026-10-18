# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/pdf/Dockerfile -t murafaa-pdf .
# Internal Cloud Run service (ingress: internal only); the API calls it with PDF_SERVICE_TOKEN.
FROM node:24.22.0-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH PUPPETEER_CACHE_DIR=/puppeteer
RUN corepack enable && corepack prepare pnpm@12.14.0 --activate
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --filter=@murafaa/pdf...
RUN pnpm turbo run build --filter=@murafaa/pdf
RUN pnpm deploy --filter=@murafaa/pdf --prod /out

FROM node:24.22.0-slim AS runtime
# Chrome's runtime libraries plus Arabic fonts (Noto Naskh/Kufi Arabic, Amiri);
# without them Arabic renders as empty boxes.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-noto-core fonts-hosny-amiri fonts-dejavu-core \
      libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdrm2 libgbm1 libgtk-3-0 \
      libnss3 libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=8080 PUPPETEER_CACHE_DIR=/puppeteer
WORKDIR /app
COPY --from=build --chown=node:node /out ./
COPY --from=build --chown=node:node /puppeteer /puppeteer
USER node
EXPOSE 8080
CMD ["node", "dist/src/main.js"]
