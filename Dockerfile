# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Murafaa — production image for Cloud Run (me-central2 / Dammam).
#
# Debian slim rather than Alpine, deliberately: this image needs BOTH Chromium
# (puppeteer renders the PDFs in src/lib/pdf/render.ts) and Prisma's engine,
# and both are markedly less troublesome against glibc than musl.
#
# Chromium is installed from Debian and puppeteer is told to use it —
# downloading its own copy would add several hundred MB and pin a browser
# Debian isn't patching.
# ─────────────────────────────────────────────────────────────────────────────

# ── deps ─────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json ./
RUN npm ci

# ── build ────────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` runs `prisma generate` first (see package.json build script).
# DATABASE_URL is not needed to generate — only to migrate — so no live
# database is required at image-build time.
RUN npm run build

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates chromium fonts-liberation \
      # Arabic-capable font: without it every generated PDF renders Arabic as
      # empty boxes, which is silent and only shows up in the output file.
      fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Cloud Run injects PORT; Next's standalone server reads both of these.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Run unprivileged. Chromium must never run as root, and neither should a
# process handling other people's case files.
#
# The user is created BEFORE the copies so ownership can be set by COPY --chown.
# Doing it afterwards with `chown -R /app` cost 241MB: chown rewrites every
# file, and a rewritten file is a new file to the layer store, so the whole
# application tree was stored twice in the image.
RUN useradd --system --uid 1001 --create-home murafaa

# The GCS SDK is loaded through a non-literal dynamic import and is intentionally
# absent from package.json (see src/lib/storage/gcs.ts) so dev never needs it.
# Production does — install it here, not in the repo. Left root-owned: the app
# only ever reads it, and code the runtime user cannot rewrite is the safer
# arrangement anyway.
RUN npm install --no-save --omit=dev @google-cloud/storage@^7

# Standalone server + the assets Next does not trace into it.
COPY --from=builder --chown=murafaa:murafaa /app/.next/standalone ./
COPY --from=builder --chown=murafaa:murafaa /app/.next/static ./.next/static
COPY --from=builder --chown=murafaa:murafaa /app/public ./public

# Prisma's generated client and its query engine binary are not picked up by
# Next's tracing reliably; copy them explicitly.
COPY --from=builder --chown=murafaa:murafaa /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=murafaa:murafaa /app/node_modules/@prisma ./node_modules/@prisma
# Shipped so migrations can be applied by a separate job from this same image.
COPY --from=builder --chown=murafaa:murafaa /app/prisma ./prisma

# Next writes its runtime cache here; the rest of /app stays read-only to the
# app user.
RUN mkdir -p /app/.next/cache && chown murafaa:murafaa /app/.next/cache

USER murafaa

EXPOSE 8080

# NOTE: migrations are deliberately NOT run here. Cloud Run starts many
# instances concurrently and they would race. Apply them as a separate step
# before routing traffic — see docs/DEPLOYMENT.md.
CMD ["node", "server.js"]
