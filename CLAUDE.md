# CLAUDE.md

Control file for Claude Code. Read this fully before doing anything in this repo.

## What this project is

**Murafaa (مُرافعة)** — an AI-powered law-office management platform for the **Saudi Arabian** legal market. Arabic-first, **RTL**, built around Saudi legal workflows (Najiz classification, litigation stages, 30-day objection deadlines, ZATCA VAT invoicing, GOSI/WPS payroll).

A high-fidelity front-end **prototype** exists at `prototype/murafaa-prototype.html` (single file, mock data, no backend). It is the **visual/behavioral reference only** — do NOT port its HTML/JS directly. Build the real product from the docs.

The first implementation (single Next.js app + Prisma) lives in `legacy/` as **reference only**: it is outside the workspace and CI. Port logic from it with its tests; never import from it. `docs/MIGRATION.md` maps every legacy file, screen, route and model to its new home or milestone; update it in the same change that ports something. The current architecture is in `docs/adr/0001-monorepo-nestjs-drizzle.md`.

## Owner decisions (binding)

- **2026-07-05:** `office_id` on every table from day one; isolation is enforced by Postgres RLS.
- **2026-07-24:** the prototype is the **binding visual reference** for the chrome and screens, matched 1:1 (sizes, radii, colours, spacing). Rebuild it with the stack; never port its HTML/JS. The docs stay binding for behaviour and business rules.
- **2026-07-24:** PDFs are rendered with headless Chrome (puppeteer), an approved stack addition for correct Arabic shaping/RTL. Run it as its own service with Arabic fonts installed, not inside the API process.
- **No fabricated integrations:** an integration without a real connection is shown disconnected, never mocked.
- **2026-10-18:** monorepo + NestJS API + Drizzle + RLS (ADR-0001).

Open questions still waiting on the owner are listed in `docs/MIGRATION.md` (AUDIT.md section).

## Source-of-truth hierarchy

When sources conflict: **docs > prototype**. The prototype shows intended UX; the docs define what is correct.
- `docs/01-business-analysis.md` — why/what (product)
- `docs/02-technical-spec.md` — the build blueprint (architecture, stack, plan)
- `docs/03-data-model.md` — entities, fields, relationships
- `docs/04-permissions-matrix.md` — roles, modules, enforcement
- `docs/05-screens-inventory.md` — all screens, components, icons
- `docs/06-business-rules.md` — exact encoded rules

## FIRST TASK — read-only audit (do this before writing any code)

On the first session, do NOT write code. Instead: read this file, all `docs/`, and skim the prototype. Then produce a written summary of (a) your understanding of the architecture, (b) the data model as you read it, (c) any open questions or contradictions. Wait for the owner to confirm before implementing. This catches misunderstandings before they become bugs.

## Tech stack (do not deviate without approval)

Decided 2026-10-18 (ADR-0001). Versions are pinned in each `package.json`.

- **Monorepo:** pnpm 12 + Turborepo, Node 24 (`.nvmrc`, run `nvm use`), TypeScript 6 `strict`, ESM everywhere (relative imports end in `.js`).
- **Layout:**
  ```
  apps/api      NestJS 12 (Fastify) — the ONLY backend. REST /api/v1 + OpenAPI.
  apps/web      Next.js 16 (App Router) — UI only, no business logic, calls the API via @murafaa/sdk.
  apps/mobile   Expo — later; same API/SDK/packages.
  packages/rules      pure business rules (docs/06) + tests
  packages/auth       roles/modules/levels, seed matrix, pure permission engine (docs/04)
  packages/contracts  Zod 4 request/response schemas — the single source for validation, OpenAPI and the SDK
  packages/i18n       message catalogs + typed t() + formatters (shared by web and mobile)
  packages/database   Drizzle schema, RLS policies, migrations, withTenant()
  packages/documents  document templates (seed data) + pure rendering (autofill, field-deny, escaping, Hijri)
  packages/sdk        API client GENERATED from apps/api/openapi.json — never edit src/gen
  packages/config     ESLint (incl. no-Arabic-literal rule) and tsconfig presets
  ```
- **UI:** Tailwind CSS 4 + shadcn/ui (Radix), full **RTL**, fonts: IBM Plex Sans Arabic + Amiri, prototype tokens in `@theme`.
- **i18n:** all UI text via `@murafaa/i18n` `t()` — **never hardcode Arabic strings in components** (ESLint fails on it).
- **DB:** PostgreSQL (Cloud SQL, Dammam) + **pgvector**, **row-level security on `office_id` always on**.
- **ORM:** Drizzle (schema + policies are the source of truth; reviewed SQL migrations).
- **AI:** Claude via **Vertex AI** (regional endpoint), called from `apps/api` only.
- **Auth:** in the API — phone/WhatsApp **OTP** → httpOnly cookie (web) / bearer + refresh (mobile).
- **Jobs:** transactional `outbox` table + Cloud Tasks + Cloud Scheduler. **No in-process cron.**
- **Storage:** Google Cloud Storage (Dammam)
- **Hosting:** Cloud Run (api, web)
- **Hosting region: Google Cloud Dammam (`me-central2`)** — data residency for PDPL

## Commands

```bash
nvm use && pnpm install
pnpm db:up               # local Postgres 17 + pgvector on :5440 (Docker)
MIGRATION_DATABASE_URL=postgres://murafaa:murafaa@localhost:5440/murafaa_dev pnpm db:migrate
DATABASE_URL=postgres://murafaa_api:murafaa_api@localhost:5440/murafaa_dev pnpm db:seed   # demo office, users 0500000001–6 (runs as the app role)
pnpm dev                 # api :4000, web :3000
pnpm build
pnpm lint                # lint (incl. i18n rule)
pnpm typecheck
pnpm test                # unit tests (business rules MUST be covered)
pnpm test:e2e            # RLS isolation + HTTP pipeline against real Postgres
pnpm db:generate         # new Drizzle migration after a schema change
pnpm db:reset            # empty a LOCAL dev database (refuses anything else), then db:seed
pnpm sdk:generate        # after any API contract change (CI fails if stale)
```
Details: `docs/DEVELOPMENT.md`.

## Conventions

- Code, identifiers, comments: **English**. UI strings: **Arabic via i18n**.
- TypeScript strict; validate all server inputs with **Zod** contracts from `packages/contracts` (`@ZodBody/@ZodQuery/@ZodParams`, `@ZodResponse` for docs).
- Money: store as **integer minor units (halalas)** — never floats.
- Every table has: `id` (UUID), `created_at`, `updated_at`, `created_by`, `deleted_at` (soft delete) — use the helpers in `packages/database/src/schema/_helpers.ts`.
- Every tenant table: `office_id`, `tenantPolicy()`, `.enableRLS()`, plus `FORCE ROW LEVEL SECURITY` and least-privilege grants in a custom migration (no DELETE for the app role).
- Services touch tenant data only through `TenantDb.run()`; the API connects as a non-owner role so RLS always applies.
- Every route declares `@Public()`, `@Authenticated()` or `@RequirePermission(module, action)`; undeclared routes are denied.
- API responses: uniform `{ data, error }` (added by the envelope interceptor / exception filter); errors carry a `code` and an i18n `messageKey`, never display text.
- Keep modules cleanly separated (cases, clients, documents, finance, hr, ai, integrations, auth); a module never reads another module's tables directly.

## NON-NEGOTIABLE GUARDRAILS

1. **Legal AI safety:** NO legal output (assistant, arena, case analysis) may reach the user without passing the **RAG + citation-verification gate** (`docs/02` §6). The AI cites ONLY from the closed knowledge base. Any citation without a matching source is blocked. Never let the model invent article numbers or rulings.
2. **Permissions are enforced server-side**, all three layers (module access, field denial, row scope — `docs/04`). The UI only hides; the server denies. **No "god mode"** — every session has an explicit role. Office isolation is enforced by Postgres RLS, never by app filters alone.
3. **PDPL / data residency:** all data (DB, storage, processing) stays in-Kingdom. Case data is personal data — minimize PII in AI prompts, use the regional AI endpoint, log access in `AUDIT`. Never put secrets/API keys in client code.
4. **Business rules are law:** implement exactly as in `docs/06` (VAT 15%, objection deadline = judgment + 30 days, 4 fee types, conflict detection, end-of-service, Nitaqat, invoice status, advance deduction). Cover each with a unit test.
5. **Money integrity:** financial/trust operations run inside DB transactions; trust (أمانات) accounting is separate from office revenue.
6. **Do not break RTL** or hardcode strings.

## Build order

Follow the phased plan in `docs/02-technical-spec.md` §13 (dependency-ordered): foundation → cases/CRM → documents → finance → **AI gate** → HR → integrations → portals → pilot. Build the MVP (phases 1–4) before the rest.

## Do NOT

- Port prototype HTML/JS directly.
- Add a tech not in the stack above without approval.
- Enforce permissions only in the UI.
- Ship any legal AI output that bypasses the citation gate.
- Store money as floats or secrets in client code.
- Write code on the first session before the read-only audit is confirmed.
- Import from `legacy/`, run cron inside the API process, or hand-edit `packages/sdk/src/gen`.
