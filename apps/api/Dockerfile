# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f apps/api/Dockerfile -t murafaa-api .
FROM node:24.22.0-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@12.14.0 --activate
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@murafaa/api...
# A self-contained production copy of the API and its workspace packages.
RUN pnpm deploy --filter=@murafaa/api --prod /out

FROM node:24.22.0-slim AS runtime
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 8080
CMD ["node", "dist/src/main.js"]
