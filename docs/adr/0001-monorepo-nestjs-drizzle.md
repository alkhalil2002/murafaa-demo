# ADR-0001: Monorepo with a separate NestJS API, Drizzle and Postgres RLS

- **Status:** Accepted (owner, 2026-10-18)
- **Supersedes:** the single Next.js app (server actions + Prisma + Auth.js) described in the original `docs/02` and now kept in `legacy/`

## Context

- **Mobile is coming.** A mobile app is planned. Server actions can't be called from Expo, and Auth.js is tied to Next.js. A single Next.js app would need a second API layer later, with the business logic duplicated.
- **Isolation must not depend on app code alone.** Tenant isolation was a `where officeId` filter in application code. One missed filter leaks another office's case data, which is personal data under PDPL.
- **We have a working reference.** Alkhalil EMS, our production system, already runs a pnpm + Turborepo monorepo with a NestJS API, Next.js web, Expo mobile, Drizzle, and Postgres RLS. We know its weaknesses:
  - no CI;
  - cron jobs that run in-process;
  - two hand-written API clients;
  - i18n configured but unused;
  - mixed money types;
  - hosting outside the Kingdom.

## Decision

1. **Structure:** a pnpm + Turborepo monorepo.
   - `apps/api` (NestJS 12 on Fastify) is the only backend: REST under `/api/v1`, OpenAPI.
   - `apps/web` (Next.js 16) is UI only.
   - `apps/mobile` (Expo) comes later.
   - Shared packages: `rules`, `auth`, `contracts`, `i18n`, `database`, `sdk`, `config`.
2. **Drizzle instead of Prisma.**
   - Policies live in the schema (`pgPolicy`).
   - `withTenant()` sets `app.office_id` with `set_config(..., is_local)` inside each transaction.
3. **RLS always on, no flag.**
   - The API connects as `murafaa_api`, a LOGIN member of the NOLOGIN role `murafaa_app`, which owns nothing.
   - Every table has `ENABLE` + `FORCE ROW LEVEL SECURITY` and a `tenant_isolation` policy.
   - The app role has no DELETE (soft delete only), and the audit log is append-only.
   - An e2e test fails if any public table lacks RLS or a policy.
4. **Contract-first.**
   - Zod 4 schemas in `packages/contracts` are the single source.
   - From them, the API generates OpenAPI 3.1, and `@hey-api/openapi-ts` generates `packages/sdk`, which web and mobile use.
   - CI fails if the committed SDK is stale.
5. **Fail-closed RBAC.**
   - In `strict` mode, a route without `@Public`, `@Authenticated` or `@RequirePermission` is denied.
   - Boot fails in production unless `RBAC_ENFORCEMENT=strict`.
   - Denials are audited.
6. **Jobs:** a transactional `outbox` table plus Cloud Tasks (dispatcher in a later milestone), never in-process cron.
7. **i18n is enforced by lint.** ESLint fails on Arabic string literals or JSX text in `apps/web` (and later `apps/mobile`).

## Version notes (checked 2026-10-18)

- **TypeScript 6.0.3, not 7.0.2.** `@nestjs/swagger@12` and `typescript-eslint@8` support TypeScript < 6.1 only.
- **NestJS 12 without `nestjs-zod`.**
  - `nestjs-zod@5.5.0` and `@ts-rest/nest` support NestJS ≤ 11.
  - We wrote a small layer in `apps/api/src/common/zod/` instead: a validation pipe, the `@ZodBody/@ZodQuery/@ZodParams/@ZodResponse` decorators, and an OpenAPI builder on `z.toJSONSchema()`.
  - Revisit when `nestjs-zod` supports NestJS 12.
- **NestJS 12 is ESM-only.** The whole repo is ESM (`"type": "module"`, `nodenext`), so relative imports use `.js`.
- **Decorator metadata in tests.** Vitest uses `unplugin-swc`, because esbuild doesn't emit the decorator metadata Nest's DI needs.
- **Drizzle 0.45.4 (stable).** 1.0 is still a release candidate.
- **No next-intl.** The shared catalog is flat with dotted keys, and 9 keys are both a leaf and a prefix (e.g. `hr.payroll` and `hr.payroll.*`), which next-intl can't represent. Web uses the typed `t()` from `@murafaa/i18n`, the same one mobile will use.
- **ESLint 10 peer warnings.** `eslint-config-next@16` pulls plugins (import, jsx-a11y, react) that don't declare ESLint 10 peer support yet. They run correctly; the warnings stay until upstream catches up.
- **pnpm 12 build scripts are explicit.** `pnpm-workspace.yaml` `allowBuilds`:
  - allowed: esbuild and `@swc/core`;
  - denied: `@scarf/scarf` telemetry and the `unrs-resolver` fallback.

- **PDF rendering keeps the owner-approved headless Chrome** (puppeteer, decision 2026-07-24). It moves out of the API into its own Cloud Run service (M3), so the API image stays small and Chromium can't stall API requests.

## Consequences

- **Bigger initial setup** than a single Next app (7 packages, 2 apps), but mobile reuses the API, contracts, SDK, rules, auth and i18n unchanged.
- **The legacy app is reference material only.** It stays under `legacy/`, outside the workspace and CI. Rules, permissions, the citation gate, document templates and the i18n catalog were ported with their tests (108 of the 115 legacy test cases). `docs/MIGRATION.md` tracks everything else.
- **The table owner is subject to FORCE RLS too.** Seeds and data migrations must set `app.office_id` (or run as a superuser locally).
- **Local and CI Postgres image:** `pgvector/pgvector:pg17`. Production: Cloud SQL in `me-central2`.
