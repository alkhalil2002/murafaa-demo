# CLAUDE.md

Control file for Claude Code. Read this fully before doing anything in this repo.

## What this project is

**Murafaa (مُرافعة)** — an AI-powered law-office management platform for the **Saudi Arabian** legal market. Arabic-first, **RTL**, built around Saudi legal workflows (Najiz classification, litigation stages, 30-day objection deadlines, ZATCA VAT invoicing, GOSI/WPS payroll).

A high-fidelity front-end **prototype** exists at `prototype/murafaa-prototype.html` (single file, mock data, no backend). It is the **visual/behavioral reference only** — do NOT port its HTML/JS directly. Build the real product from the docs.

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

- **Framework:** Next.js (App Router), **TypeScript `strict`**
- **UI:** Tailwind CSS + shadcn/ui (Radix), full **RTL**, fonts: IBM Plex Sans Arabic + Amiri
- **i18n:** all UI text via the i18n layer — **never hardcode Arabic strings in components**
- **DB:** PostgreSQL (Cloud SQL, Dammam region) + **pgvector** extension
- **ORM:** Prisma (schema is the single source of truth; use migrations)
- **AI:** Claude via **Vertex AI** (regional endpoint)
- **Auth:** Auth.js + phone/WhatsApp **OTP**
- **Jobs:** Cloud Tasks + Cloud Scheduler
- **Storage:** Google Cloud Storage (Dammam)
- **Hosting:** Cloud Run
- **Hosting region: Google Cloud Dammam (`me-central2`)** — data residency for PDPL

## Commands

```bash
npm run dev          # local dev
npm run build        # production build
npm run lint         # lint + typecheck
npm test             # unit tests (business rules MUST be covered)
npx prisma migrate dev   # apply DB migrations
npx prisma studio        # inspect data
```
(Fill exact scripts in package.json at setup.)

## Conventions

- Code, identifiers, comments: **English**. UI strings: **Arabic via i18n**.
- TypeScript strict; validate all server inputs with **Zod**.
- Money: store as **integer minor units (halalas)** — never floats.
- Every table has: `id` (UUID), `created_at`, `updated_at`, `created_by`, `deleted_at` (soft delete).
- API responses: uniform `{ data, error }`.
- Keep modules cleanly separated (cases, clients, documents, finance, hr, ai, integrations, auth).

## NON-NEGOTIABLE GUARDRAILS

1. **Legal AI safety:** NO legal output (assistant, arena, case analysis) may reach the user without passing the **RAG + citation-verification gate** (`docs/02` §6). The AI cites ONLY from the closed knowledge base. Any citation without a matching source is blocked. Never let the model invent article numbers or rulings.
2. **Permissions are enforced server-side**, all three layers (module access, field denial, row scope — `docs/04`). The UI only hides; the server denies. **No "god mode"** — every session has an explicit role.
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
