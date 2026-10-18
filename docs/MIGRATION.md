# Legacy → new architecture migration tracker

Every file, screen, route and model in `legacy/` with where it went or which milestone owns it, so no feature is lost in the rebuild (ADR-0001). Update this file in the same PR that ports something.

Milestones follow `docs/02` §13. **M1 Foundation** now also includes: staff OTP login, TOTP 2FA, editable permissions (all three layers), office IP allowlist enforcement, and audit writers.

## Summary (2026-10-18)

| Area | Legacy | ✅ Ported | Remaining |
|---|---|---|---|
| `src/lib` files | 51 | 20 | 31 (pending or rebuild) |
| Business rules inside services/components | 37 found | 26 | 11 (with their modules) |
| Service capabilities | 225 | 0 endpoints | 225 (checklist below) |
| Server actions files | 29 | 0 | 29 |
| Screens / layouts | 63 + 3 | 1 layout | 63 + 2 |
| Components | 20 | 0 | 20 (behaviours listed below) |
| Route handlers | 9 | 0 | 9 |
| Models | 56 | 3 (+ `outbox` new) | 53 |
| Uniqueness rules | 25 | 1 (`users` office + phone) | 24 |
| Audited actions | 113 | 1 (`permission.denied`) | 112 |
| Owner decisions found in code | 4 | 4 recorded | — |
| AUDIT.md questions | 12 (+2 new) | 6 implemented | 8 open or to confirm |
| Legacy test cases | 115 | 108 | 7 (`portal` 5 rewrite in M8, `hearing-draft` 2 not ported) |

Legend: ✅ Ported (with tests) · ⏳ Pending (milestone) · 🔁 Rebuild (design changes, reason given) · ⛔ Not ported (reason given)

## `src/lib` (51 files)

| File | Status | Where / milestone | Notes |
|---|---|---|---|
| `ai/embed.ts` | 🔁 Rebuild | M5 AI gate | 64-dim hash stub → Vertex embeddings + pgvector |
| `ai/gate.ts` | ✅ Ported | apps/api/src/modules/ai/gate.ts | 17 tests |
| `ai/hearing-draft.ts` | 🔁 Rebuild | M5 AI gate | called api.anthropic.com outside the Kingdom and skipped the gate (guardrails 1, 3) |
| `ai/kb-seed.ts` | ⏳ Pending | M5 AI gate | knowledge-base seed |
| `ai/llm.ts` | 🔁 Rebuild | M5 AI gate | StubLlm → Claude on Vertex (me-central2) |
| `ai/vector.ts` | 🔁 Rebuild | M5 AI gate | in-app cosine over all chunks → pgvector index |
| `api/response.ts` | ✅ Ported | packages/contracts/src/envelope.ts + API envelope interceptor/filter |  |
| `audit/index.ts` | ⏳ Pending | M1 Foundation | audit_log table exists; login/sensitive-action writers come with auth |
| `auth/config.ts` | 🔁 Rebuild | M1 Foundation | Auth.js → API-issued sessions |
| `auth/emp-portal-otp.ts` | ⏳ Pending | M8 Portals | employee-portal OTP |
| `auth/emp-portal-session.ts` | ⏳ Pending | M8 Portals |  |
| `auth/index.ts` | 🔁 Rebuild | M1 Foundation | staff login (OTP + TOTP) in apps/api auth module |
| `auth/otp-provider.ts` | ⏳ Pending | M1 Foundation | console (dev) + Unifonic (legacy choice, Saudi SMS/WhatsApp) adapter; Buraq/Meta adapters exist in Alkhalil |
| `auth/otp.ts` | ⏳ Pending | M1 Foundation | staff OTP challenge/verify |
| `auth/phone.ts` | ✅ Ported | packages/rules/src/phone.ts | 2 tests |
| `auth/portal-otp.ts` | ⏳ Pending | M8 Portals | client-portal OTP |
| `auth/portal-session.ts` | ⏳ Pending | M8 Portals |  |
| `auth/role-preview.ts` | ⏳ Pending | M1 Foundation | effectiveRole() ported in packages/auth; session plumbing pending |
| `auth/session.ts` | 🔁 Rebuild | M1 Foundation | httpOnly cookie (web) / bearer + refresh (mobile) |
| `auth/totp.ts` | ✅ Ported | apps/api/src/modules/auth/totp.ts | RFC 6238 tests added; encrypt the secret at rest (legacy stored it in plaintext) |
| `auth/types.ts` | ✅ Ported | apps/api/src/common/tenancy/principal.ts |  |
| `case-events.ts` | ⏳ Pending | M2 Core ops | case timeline writer |
| `cities.ts` | ✅ Ported | packages/rules/src/reference/cities.ts |  |
| `conflict/engine.ts` | ✅ Ported | packages/rules/src/conflict.ts | 11 tests |
| `conflict/service.ts` | ⏳ Pending | M2 Core ops | loads office candidates, persists ConflictFlag |
| `dates.ts` | ✅ Ported | packages/rules/src/dates.ts | 5 tests |
| `db.ts` | 🔁 Rebuild | M1 Foundation | Prisma client → packages/database createDb/withTenant (RLS) |
| `documents/render.ts` | ✅ Ported | packages/documents/src/render.ts | 7 tests (with templates) |
| `documents/template-defs.ts` | ✅ Ported | packages/documents/src/templates.ts |  |
| `finance/core.ts` | ✅ Ported | packages/rules/src/finance.ts | 19 tests |
| `finance/ledger.ts` | ⏳ Pending | M4 Finance | periodKeyOf ported (packages/rules ledger.ts); period lock, numbering with retry, postJournal are DB-bound |
| `format.ts` | ✅ Ported | packages/rules/src/pii.ts (maskIban) | tests added |
| `hr/core.ts` | ✅ Ported | packages/rules/src/hr.ts | 24 tests; band labels moved to i18n nitaqat.* |
| `i18n/ar.ts` | ✅ Ported | packages/i18n/src/ar.ts | + health/errors/currency keys |
| `i18n/index.ts` | ✅ Ported | packages/i18n/src/index.ts | + en fallback, dirOf, formatSar |
| `labels.ts` | ⏳ Pending | M2 Core ops | enum → i18n label maps; coverage test in packages/i18n |
| `money.ts` | ✅ Ported | packages/rules/src/money.ts | 3 tests; formatSar moved to i18n |
| `najiz.ts` | ✅ Ported | packages/rules/src/reference/najiz.ts | tests added |
| `pdf/letterhead.ts` | ⏳ Pending | M3 Documents | escapeHtml ported to packages/documents; branding + letterhead pending |
| `pdf/render.ts` | ⏳ Pending | M3 Documents | headless Chrome (puppeteer) — owner-approved 2026-07-24 for correct Arabic shaping/RTL; run it in a separate Cloud Run service with Arabic fonts, not inside the API |
| `performance.ts` | ⏳ Pending | M6 HR | PERFORMANCE_POINTS ported (packages/rules performance.ts); event log writer pending |
| `permissions/engine.ts` | ✅ Ported | packages/auth/src/engine.ts | 20 tests |
| `permissions/guard.ts` | 🔁 Rebuild | M1 Foundation | layer 1 done (PermissionsGuard, fail-closed, audited); layers 2–3 wired with cases |
| `permissions/matrix.ts` | ✅ Ported | packages/auth/src/matrix.ts + policy.ts (seedPolicy) |  |
| `permissions/policy.ts` | 🔁 Rebuild | M1 Foundation | editable DB policy; no process-local cache (stale on multi-instance Cloud Run) |
| `permissions/scope.ts` | ⏳ Pending | M2 Core ops | row scope (ALL/ASSIGNED) as a Drizzle where-clause |
| `security/ip.ts` | ✅ Ported | apps/api/src/common/security/ip-allowlist.ts | tests added; enforcement hook pending (M1) |
| `storage/gcs.ts` | ⏳ Pending | M3 Documents | GCS me-central2 |
| `storage/index.ts` | ⏳ Pending | M3 Documents |  |
| `storage/local.ts` | ⏳ Pending | M3 Documents | dev storage |
| `storage/types.ts` | ⏳ Pending | M3 Documents |  |

## `src/server` services (54 files)

All pending: each becomes a NestJS module in `apps/api/src/modules/` that uses `TenantDb` and Zod contracts.

| Service | Status | Milestone | Notes |
|---|---|---|---|
| `activity` | ⏳ Pending | M2 Core ops |  |
| `ai` | ⏳ Pending | M5 AI gate | assistant + arena — every answer through the citation gate; system prompts ported to apps/api/src/modules/ai/prompts.ts |
| `alerts` | ⏳ Pending | M2 Core ops |  |
| `appointments` | ⏳ Pending | M2 Core ops |  |
| `approvals` | ⏳ Pending | M2 Core ops | approval chain order ported (packages/rules workflows.ts) |
| `billing-usage` | ⏳ Pending | M1 Foundation |  |
| `case-profitability` | ⏳ Pending | M4 Finance |  |
| `cases` | ⏳ Pending | M2 Core ops | rules ported: effectiveStage, prevProcStage/nextProcStage (packages/rules cases.ts, procedural.ts) |
| `client-approvals` | ⏳ Pending | M8 Portals |  |
| `clients` | ⏳ Pending | M2 Core ops |  |
| `communications` | ⏳ Pending | M2 Core ops |  |
| `contracts` | ⏳ Pending | M3 Documents |  |
| `dashboard` | ⏳ Pending | M2 Core ops |  |
| `deadlines` | ⏳ Pending | M2 Core ops |  |
| `documents` | ⏳ Pending | M3 Documents | upload limits + MIME allowlist ported (packages/documents uploads.ts) |
| `emp-portal` | ⏳ Pending | M8 Portals |  |
| `execution` | ⏳ Pending | M2 Core ops | statusAfterCollection + procedure status cycle ported (packages/rules workflows.ts) |
| `expenses` | ⏳ Pending | M4 Finance |  |
| `fees` | ⏳ Pending | M4 Finance |  |
| `finance-bank` | ⏳ Pending | M4 Finance |  |
| `finance-dashboard` | ⏳ Pending | M4 Finance |  |
| `finance-governance` | ⏳ Pending | M4 Finance |  |
| `hearings` | ⏳ Pending | M2 Core ops | incl. docs/06 §11 post-hearing automation (prep tasks, clash check, WhatsApp reminder) → outbox + Cloud Tasks |
| `hr/advances` | ⏳ Pending | M6 HR |  |
| `hr/attendance` | ⏳ Pending | M6 HR |  |
| `hr/employees` | ⏳ Pending | M6 HR |  |
| `hr/index` | ⏳ Pending | M6 HR |  |
| `hr/integrations` | ⏳ Pending | M7 Integrations |  |
| `hr/leaves` | ⏳ Pending | M6 HR |  |
| `hr/org-chart` | ⏳ Pending | M6 HR |  |
| `hr/payroll` | ⏳ Pending | M6 HR |  |
| `hr/recruitment` | ⏳ Pending | M6 HR | candidate pipeline ported (packages/rules workflows.ts) |
| `hr/requests` | ⏳ Pending | M6 HR |  |
| `hr/saudization` | ⏳ Pending | M6 HR |  |
| `hr/wps` | ⏳ Pending | M6 HR | WPS file generation |
| `invoices` | ⏳ Pending | M4 Finance | ZATCA e-invoicing still missing (M7) |
| `journey` | ⏳ Pending | M2 Core ops |  |
| `leads` | ⏳ Pending | M2 Core ops | pipeline order + bounded move ported (packages/rules workflows.ts) |
| `ledger-reports` | ⏳ Pending | M4 Finance | normal-side balance ported (packages/rules ledger.ts) |
| `messages` | ⏳ Pending | M2 Core ops |  |
| `notifications` | ⏳ Pending | M2 Core ops |  |
| `office-settings` | ⏳ Pending | M1 Foundation |  |
| `permissions-admin` | ⏳ Pending | M1 Foundation | editable roles/permissions/field-deny/scope |
| `portal` | ⏳ Pending | M8 Portals |  |
| `procedure-requests` | ⏳ Pending | M2 Core ops | status cycle ported (packages/rules workflows.ts) |
| `pulse` | ⏳ Pending | M6 HR | points + override rule ported (packages/rules performance.ts); legacy sinceFor() used server-local time, use Riyadh time (dates.ts) |
| `search` | ⏳ Pending | M2 Core ops |  |
| `security` | ⏳ Pending | M1 Foundation | TOTP enrol/disable + office IP allowlist |
| `security-audit` | ⏳ Pending | M1 Foundation |  |
| `settings` | ⏳ Pending | M1 Foundation |  |
| `tasks` | ⏳ Pending | M2 Core ops |  |
| `templates` | ⏳ Pending | M3 Documents |  |
| `today` | ⏳ Pending | M2 Core ops | computeWinRate rule ported as winRate (packages/rules cases.ts) |
| `trust` | ⏳ Pending | M4 Finance |  |

## Screens (63 pages)

All pending in `apps/web` (and later `apps/mobile`), built on the API through `@murafaa/sdk`. Only the status page exists today.

| Route | Status | Milestone | Notes |
|---|---|---|---|
| `/` | ⏳ Pending | M2 Core ops |  |
| `/account/security` | ⏳ Pending | M1 Foundation |  |
| `/activity` | ⏳ Pending | M2 Core ops |  |
| `/ai` | ⏳ Pending | M5 AI gate |  |
| `/ai/arena/[caseId]` | ⏳ Pending | M5 AI gate |  |
| `/ai/kb` | ⏳ Pending | M5 AI gate |  |
| `/alerts` | ⏳ Pending | M2 Core ops |  |
| `/appointments` | ⏳ Pending | M2 Core ops |  |
| `/billing` | ⏳ Pending | M1 Foundation |  |
| `/cases` | ⏳ Pending | M2 Core ops |  |
| `/cases/[id]` | ⏳ Pending | M2 Core ops |  |
| `/cases/new` | ⏳ Pending | M2 Core ops |  |
| `/clients` | ⏳ Pending | M2 Core ops |  |
| `/dashboard` | ⏳ Pending | M2 Core ops |  |
| `/deadlines` | ⏳ Pending | M2 Core ops |  |
| `/documents` | ⏳ Pending | M3 Documents |  |
| `/documents/new/[key]` | ⏳ Pending | M3 Documents |  |
| `/emp-portal/(app)` | ⏳ Pending | M8 Portals |  |
| `/emp-portal/login` | ⏳ Pending | M8 Portals |  |
| `/finance` | ⏳ Pending | M4 Finance |  |
| `/finance/[id]` | ⏳ Pending | M4 Finance |  |
| `/finance/bank` | ⏳ Pending | M4 Finance |  |
| `/finance/coa` | ⏳ Pending | M4 Finance |  |
| `/finance/dashboard` | ⏳ Pending | M4 Finance |  |
| `/finance/expenses` | ⏳ Pending | M4 Finance |  |
| `/finance/governance` | ⏳ Pending | M4 Finance |  |
| `/finance/journal` | ⏳ Pending | M4 Finance |  |
| `/finance/ledger` | ⏳ Pending | M4 Finance |  |
| `/finance/profitability` | ⏳ Pending | M4 Finance |  |
| `/finance/statements` | ⏳ Pending | M4 Finance |  |
| `/finance/trust` | ⏳ Pending | M4 Finance |  |
| `/finance/trust/[clientId]` | ⏳ Pending | M4 Finance |  |
| `/hr` | ⏳ Pending | M6 HR |  |
| `/hr/[id]` | ⏳ Pending | M6 HR |  |
| `/hr/advances` | ⏳ Pending | M6 HR |  |
| `/hr/attendance` | ⏳ Pending | M6 HR |  |
| `/hr/integrations` | ⏳ Pending | M6 HR |  |
| `/hr/leaves` | ⏳ Pending | M6 HR |  |
| `/hr/org` | ⏳ Pending | M6 HR |  |
| `/hr/payroll` | ⏳ Pending | M6 HR |  |
| `/hr/payroll/[id]` | ⏳ Pending | M6 HR |  |
| `/hr/performance` | ⏳ Pending | M6 HR |  |
| `/hr/recruitment` | ⏳ Pending | M6 HR |  |
| `/hr/requests` | ⏳ Pending | M6 HR |  |
| `/hr/saudization` | ⏳ Pending | M6 HR |  |
| `/journey` | ⏳ Pending | M2 Core ops |  |
| `/leads` | ⏳ Pending | M2 Core ops |  |
| `/login` | ⏳ Pending | M1 Foundation |  |
| `/notifications` | ⏳ Pending | M2 Core ops |  |
| `/perms` | ⏳ Pending | M1 Foundation |  |
| `/perms/audit` | ⏳ Pending | M1 Foundation |  |
| `/perms/security` | ⏳ Pending | M1 Foundation |  |
| `/perms/users` | ⏳ Pending | M1 Foundation |  |
| `/portal/(app)` | ⏳ Pending | M8 Portals |  |
| `/portal/(app)/cases/[id]` | ⏳ Pending | M8 Portals |  |
| `/portal/(app)/invoices` | ⏳ Pending | M8 Portals |  |
| `/portal/login` | ⏳ Pending | M8 Portals |  |
| `/pulse` | ⏳ Pending | M6 HR |  |
| `/search` | ⏳ Pending | M2 Core ops |  |
| `/settings` | ⏳ Pending | M1 Foundation |  |
| `/tasks` | ⏳ Pending | M2 Core ops |  |
| `/today` | ⏳ Pending | M2 Core ops |  |
| `/whatsapp` | ⏳ Pending | M7 Integrations |  |

## Route handlers (9)

| Route | Status | Milestone | Notes |
|---|---|---|---|
| `api/auth/2fa-status` | 🔁 Rebuild | M1 Foundation | API endpoint |
| `api/auth/[...nextauth]` | 🔁 Rebuild | M1 Foundation | Auth.js removed; API sessions |
| `api/auth/otp` | ⏳ Pending | M1 Foundation |  |
| `api/documents/[id]/download` | ⏳ Pending | M3 Documents | signed GCS URL |
| `api/emp-portal-auth/otp` | ⏳ Pending | M8 Portals |  |
| `api/emp-portal-auth/verify` | ⏳ Pending | M8 Portals |  |
| `api/portal-auth/otp` | ⏳ Pending | M8 Portals |  |
| `api/portal-auth/verify` | ⏳ Pending | M8 Portals |  |
| `api/search` | ⏳ Pending | M2 Core ops |  |

## Prisma models (56) → Drizzle tables

New tables need `office_id` + RLS policy + FORCE RLS + grants (see `docs/DEVELOPMENT.md`). Enums used by rules already live in `packages/rules`, `packages/auth` and `packages/documents`.

| Model | Status | Where / milestone | Notes |
|---|---|---|---|
| `Office` | ✅ Ported | packages/database offices |  |
| `User` | ✅ Ported | packages/database users (no OTP fields yet) |  |
| `OtpChallenge` | ⏳ Pending | M1 Foundation |  |
| `Permission` | ⏳ Pending | M1 Foundation |  |
| `FieldPermission` | ⏳ Pending | M1 Foundation |  |
| `RoleCaseScope` | ⏳ Pending | M1 Foundation |  |
| `Client` | ⏳ Pending | M2 Core ops |  |
| `Case` | ⏳ Pending | M2 Core ops |  |
| `CaseAssignee` | ⏳ Pending | M2 Core ops |  |
| `AuditLog` | ✅ Ported | packages/database audit_log (append-only) |  |
| `Hearing` | ⏳ Pending | M2 Core ops |  |
| `CaseEvent` | ⏳ Pending | M2 Core ops |  |
| `CaseReminder` | ⏳ Pending | M2 Core ops |  |
| `Lead` | ⏳ Pending | M2 Core ops |  |
| `Task` | ⏳ Pending | M2 Core ops |  |
| `Appointment` | ⏳ Pending | M2 Core ops |  |
| `ConflictFlag` | ⏳ Pending | M2 Core ops |  |
| `NajizClassification` | ⏳ Pending | M2 Core ops |  |
| `DocumentTemplate` | ⏳ Pending | M3 Documents |  |
| `Document` | ⏳ Pending | M3 Documents |  |
| `CaseFeeAgreement` | ⏳ Pending | M4 Finance |  |
| `Invoice` | ⏳ Pending | M4 Finance |  |
| `InvoiceItem` | ⏳ Pending | M4 Finance |  |
| `Payment` | ⏳ Pending | M4 Finance |  |
| `CreditNote` | ⏳ Pending | M4 Finance |  |
| `Expense` | ⏳ Pending | M4 Finance |  |
| `TimeEntry` | ⏳ Pending | M4 Finance |  |
| `TrustAccount` | ⏳ Pending | M4 Finance |  |
| `TrustTransaction` | ⏳ Pending | M4 Finance |  |
| `ChartOfAccount` | ⏳ Pending | M4 Finance |  |
| `JournalEntry` | ⏳ Pending | M4 Finance |  |
| `JournalLine` | ⏳ Pending | M4 Finance |  |
| `AccountingPeriod` | ⏳ Pending | M4 Finance |  |
| `KnowledgeSource` | ⏳ Pending | M5 AI gate |  |
| `KnowledgeChunk` | ⏳ Pending | M5 AI gate |  |
| `AiInteraction` | ⏳ Pending | M5 AI gate |  |
| `AiCitation` | ⏳ Pending | M5 AI gate |  |
| `Employee` | ⏳ Pending | M6 HR |  |
| `Advance` | ⏳ Pending | M6 HR |  |
| `Leave` | ⏳ Pending | M6 HR |  |
| `IntegrationConnection` | ⏳ Pending | M7 Integrations |  |
| `Candidate` | ⏳ Pending | M6 HR |  |
| `Attendance` | ⏳ Pending | M6 HR |  |
| `EmployeeRequest` | ⏳ Pending | M6 HR |  |
| `PayrollRun` | ⏳ Pending | M6 HR |  |
| `PayrollLine` | ⏳ Pending | M6 HR |  |
| `PerformanceEvent` | ⏳ Pending | M6 HR |  |
| `OfficePerformanceWeight` | ⏳ Pending | M6 HR |  |
| `CaseApproval` | ⏳ Pending | M2 Core ops |  |
| `ClientApprovalRequest` | ⏳ Pending | M8 Portals |  |
| `ProcedureRequest` | ⏳ Pending | M2 Core ops |  |
| `ClientCommunication` | ⏳ Pending | M2 Core ops |  |
| `CaseMessage` | ⏳ Pending | M2 Core ops |  |
| `Contract` | ⏳ Pending | M3 Documents |  |
| `CaseExecution` | ⏳ Pending | M2 Core ops |  |
| `ExecutionProcedure` | ⏳ Pending | M2 Core ops |  |

## Tests (11 files)

| File | Status | Where | Notes |
|---|---|---|---|
| `conflict.test.ts` | ✅ Ported | packages/rules/test/conflict.test.ts | 11/11 |
| `dates.test.ts` | ✅ Ported | packages/rules/test/dates.test.ts | 5/5 |
| `documents.test.ts` | ✅ Ported | packages/documents/test/documents.test.ts | 7/7 |
| `finance.test.ts` | ✅ Ported | packages/rules/test/finance.test.ts | 19/19 |
| `gate.test.ts` | ✅ Ported | apps/api/test/gate.test.ts | 17/17 |
| `hearing-draft.test.ts` | ⛔ Not ported | — | tests the non-compliant direct-Anthropic path; rewrite with the M5 Vertex + gate version |
| `hr.test.ts` | ✅ Ported | packages/rules/test/hr.test.ts | 24/24 |
| `money.test.ts` | ✅ Ported | packages/rules/test/money.test.ts | 3/3 |
| `permissions.test.ts` | ✅ Ported | packages/auth/test/permissions.test.ts | 20/20 |
| `phone.test.ts` | ✅ Ported | packages/rules/test/phone.test.ts | 2/2 |
| `portal.test.ts` | ⏳ Pending | M8 Portals | Prisma integration test; rewrite as API e2e |

## Components (20)

Pending in `apps/web/src/components` with shadcn/ui; the app shell and nav come first with M1 login. `idle-logout.tsx` and `cases/ai-draft-hearing-button.tsx` hard-coded Arabic; rebuild them through i18n.

| Component | Status | Milestone | Notes |
|---|---|---|---|
| `ai-answer.tsx` | ⏳ Pending | M5 AI gate |  |
| `app-shell.tsx` | ⏳ Pending | M1 Foundation |  |
| `auth/login-form.tsx` | ⏳ Pending | M1 Foundation |  |
| `auto-submit-select.tsx` | ⏳ Pending | M1 Foundation |  |
| `cases/ai-draft-hearing-button.tsx` | ⏳ Pending | M2 Core ops |  |
| `cases/case-list.tsx` | ⏳ Pending | M2 Core ops |  |
| `cases/hearing-wizard.tsx` | ⏳ Pending | M2 Core ops |  |
| `cases/najiz-picker.tsx` | ⏳ Pending | M2 Core ops |  |
| `cases/role-picker.tsx` | ⏳ Pending | M2 Core ops |  |
| `conflict-badge.tsx` | ⏳ Pending | M2 Core ops |  |
| `emp-portal/emp-portal-login-form.tsx` | ⏳ Pending | M8 Portals |  |
| `finance-tabs.tsx` | ⏳ Pending | M4 Finance |  |
| `hr-tabs.tsx` | ⏳ Pending | M6 HR |  |
| `hr-ui.tsx` | ⏳ Pending | M6 HR |  |
| `icons.tsx` | ⏳ Pending | M1 Foundation |  |
| `idle-logout.tsx` | ⏳ Pending | M1 Foundation |  |
| `perms-tabs.tsx` | ⏳ Pending | M1 Foundation |  |
| `portal/portal-login-form.tsx` | ⏳ Pending | M8 Portals |  |
| `shell-frame.tsx` | ⏳ Pending | M1 Foundation |  |
| `side-nav.tsx` | ⏳ Pending | M1 Foundation |  |

## Scripts (7)

| Script | Status | Where / milestone | Notes |
|---|---|---|---|
| `otp-check.ts` | ⛔ Not ported | — | replaced by e2e tests in CI |
| `phase2-check.ts` | ⛔ Not ported | — | replaced by e2e tests in CI |
| `phase3-check.ts` | ⛔ Not ported | — | replaced by e2e tests in CI |
| `phase4-check.ts` | ⛔ Not ported | — | replaced by e2e tests in CI |
| `phase5-check.ts` | ⛔ Not ported | — | replaced by e2e tests in CI |
| `phase6-check.ts` | ⛔ Not ported | — | replaced by e2e tests in CI |
| `reset-dev-data.ts` | ⏳ Pending | M1 Foundation | seed/reset script in packages/database |

## Other

| Item | Status | Where / milestone | Notes |
|---|---|---|---|
| `src/middleware.ts` | 🔁 Rebuild | M1 Foundation | auth redirects in web; authorization stays in the API |
| `src/app/globals.css (component classes)` | ⏳ Pending | M1 Foundation | tokens ported to apps/web @theme; prototype component classes with the app shell |
| `prisma/seed.ts` | ⏳ Pending | M1 Foundation | office + 6 role users seed |
| `src/app/layout.tsx (root: fonts, RTL, metadata)` | ✅ Ported | apps/web/src/app/layout.tsx |  |
| `src/app/portal/(app)/layout.tsx (client-portal shell)` | ⏳ Pending | M8 Portals |  |
| `src/app/emp-portal/(app)/layout.tsx (employee-portal shell)` | ⏳ Pending | M8 Portals |  |
| `prisma/migrations (35)` | ⛔ Not ported | — | history only; the Drizzle schema is rebuilt table by table |

## Capability checklist (225 exported service functions)

Every capability the legacy services expose. Tick each one when its API endpoint (and test) exists. A rebuilt module is not done until all of its boxes are ticked.

**activity** (M2 Core ops)

- [ ] `listActivity`
- [ ] `listActivityActors`
- [ ] `countActivityByCategory`

**ai** (M5 AI gate)

- [ ] `askAssistant`
- [ ] `runArenaTurn`
- [ ] `getArenaState`
- [ ] `runArenaRound`
- [ ] `resetArena`
- [ ] `listInteractions`
- [ ] `listKnowledgeSources`

**alerts** (M2 Core ops)

- [ ] `getSmartAlerts`

**appointments** (M2 Core ops)

- [ ] `listAppointments`
- [ ] `createAppointment`
- [ ] `cancelAppointment`

**approvals** (M2 Core ops)

- [ ] `listApprovals`
- [ ] `listPendingApprovals`
- [ ] `createApproval`
- [ ] `advanceApproval`
- [ ] `deleteApproval`
- [ ] `rejectApproval`

**billing-usage** (M1 Foundation)

- [ ] `getBillingUsage`

**case-profitability** (M4 Finance)

- [ ] `getCaseProfitability`

**cases** (M2 Core ops)

- [ ] `effectiveStage`
- [ ] `listCases`
- [ ] `listAssignableUsers`
- [ ] `getCase`
- [ ] `createCase`
- [ ] `updateCase`
- [ ] `setCaseOutcome`
- [ ] `assignUser`
- [ ] `unassignUser`
- [ ] `promoteStage`
- [ ] `remandStage`
- [ ] `endProcedure`
- [ ] `reopenProcedure`
- [ ] `toggleClosingChecklistItem`
- [ ] `setClientSatisfaction`
- [ ] `requestReferral`
- [ ] `archiveCase`

**client-approvals** (M8 Portals)

- [ ] `listClientApprovals`
- [ ] `createClientApprovalRequest`

**clients** (M2 Core ops)

- [ ] `listClients`
- [ ] `createClient`
- [ ] `updateClient`

**communications** (M2 Core ops)

- [ ] `addClientCommunication`
- [ ] `deleteClientCommunication`
- [ ] `listClientCommunications`
- [ ] `listMessageCommunications`

**contracts** (M3 Documents)

- [ ] `addContract`
- [ ] `toggleContractSigned`
- [ ] `deleteContract`
- [ ] `listContracts`

**dashboard** (M2 Core ops)

- [ ] `getDashboardSummary`

**deadlines** (M2 Core ops)

- [ ] `getDeadlines`

**documents** (M3 Documents)

- [ ] `prepareGenerateForm`
- [ ] `generateFromTemplate`
- [ ] `uploadDocument`
- [ ] `listDocuments`
- [ ] `getDocumentForDownload`
- [ ] `toggleShare`
- [ ] `softDeleteDocument`
- [ ] `clearOpeningPackage`
- [ ] `generateHearingReportPdf`

**emp-portal** (M8 Portals)

- [ ] `getEmpPortalProfile`
- [ ] `listMyRequests`
- [ ] `submitEmpRequest`

**execution** (M2 Core ops)

- [ ] `getExecution`
- [ ] `openExecution`
- [ ] `updateExecution`
- [ ] `setExecutionStatus`
- [ ] `closeExecution`
- [ ] `recordCollection`
- [ ] `addExecutionProcedure`
- [ ] `updateExecutionProcedure`
- [ ] `deleteExecutionProcedure`
- [ ] `cycleExecutionProcedure`

**expenses** (M4 Finance)

- [ ] `createExpense`
- [ ] `listExpenses`
- [ ] `reimburseExpense`
- [ ] `createTimeEntry`
- [ ] `listTimeEntries`
- [ ] `invoiceTimeEntry`

**fees** (M4 Finance)

- [ ] `getFeeAgreement`
- [ ] `saveFeeAgreement`
- [ ] `generateInvoiceFromFee`

**finance-bank** (M4 Finance)

- [ ] `getBankSummary`
- [ ] `getBankLedger`
- [ ] `toggleBankLineCleared`

**finance-dashboard** (M4 Finance)

- [ ] `getFinanceDashboard`

**finance-governance** (M4 Finance)

- [ ] `listRecentPeriods`
- [ ] `setPeriodLock`
- [ ] `getRequireApproval`
- [ ] `setRequireApproval`
- [ ] `listFinanceAudit`

**hearings** (M2 Core ops)

- [ ] `recordHearing`
- [ ] `setNextHearing`
- [ ] `updateHearing`
- [ ] `deleteHearing`
- [ ] `addHearingReminder`
- [ ] `addHearingTask`
- [ ] `requestReportApproval`
- [ ] `cancelReportApprovalRequest`
- [ ] `decideReportApproval`
- [ ] `escalateHearingReminder`
- [ ] `updateHearingReminder`
- [ ] `deleteHearingReminder`
- [ ] `updateHearingTask`
- [ ] `deleteHearingTask`
- [ ] `getHearingActions`

**hr/advances** (M6 HR)

- [ ] `createAdvance`
- [ ] `listAdvances`

**hr/attendance** (M6 HR)

- [ ] `getTodayAttendance`
- [ ] `setTodayStatus`
- [ ] `clockOut`
- [ ] `getMonthlySummary`

**hr/employees** (M6 HR)

- [ ] `createEmployee`
- [ ] `listEmployees`
- [ ] `getEmployee`
- [ ] `grantEmployeeAccount`
- [ ] `updateEmployee`
- [ ] `previewEndOfService`
- [ ] `terminateEmployee`

**hr/integrations** (M7 Integrations)

- [ ] `listIntegrations`
- [ ] `connectIntegration`
- [ ] `disconnectIntegration`
- [ ] `syncIntegrationNow`

**hr/leaves** (M6 HR)

- [ ] `createLeave`
- [ ] `listLeaves`

**hr/org-chart** (M6 HR)

- [ ] `getOrgChart`

**hr/payroll** (M6 HR)

- [ ] `runPayroll`
- [ ] `listPayrollRuns`
- [ ] `getPayrollRun`

**hr/recruitment** (M6 HR)

- [ ] `listCandidates`
- [ ] `createCandidate`
- [ ] `moveCandidate`
- [ ] `deleteCandidate`

**hr/requests** (M6 HR)

- [ ] `createRequest`
- [ ] `decideRequest`
- [ ] `listRequests`

**hr/saudization** (M6 HR)

- [ ] `getSaudizationStatus`

**hr/wps** (M6 HR)

- [ ] `generateWpsFile`

**invoices** (M4 Finance)

- [ ] `createInvoiceInTx`
- [ ] `createInvoice`
- [ ] `recordPayment`
- [ ] `issueCreditNote`
- [ ] `writeOffBadDebt`
- [ ] `listInvoices`
- [ ] `listInvoicesByClient`
- [ ] `getInvoice`

**journey** (M2 Core ops)

- [ ] `getJourneySummary`

**leads** (M2 Core ops)

- [ ] `listLeads`
- [ ] `getLeadsKpis`
- [ ] `createLead`
- [ ] `updateLead`
- [ ] `deleteLead`
- [ ] `moveLead`
- [ ] `convertLead`

**ledger-reports** (M4 Finance)

- [ ] `trialBalance`
- [ ] `agingReport`
- [ ] `vatReturn`
- [ ] `listJournal`
- [ ] `getFinancialStatements`
- [ ] `getCashFlowStatement`
- [ ] `listAccounts`
- [ ] `createManualJournalEntry`

**messages** (M2 Core ops)

- [ ] `sendCaseMessage`
- [ ] `listCaseMessages`

**notifications** (M2 Core ops)

- [ ] `getNotifications`

**office-settings** (M1 Foundation)

- [ ] `getOfficeBranding`
- [ ] `updateOfficeBranding`

**permissions-admin** (M1 Foundation)

- [ ] `getRoleMatrix`
- [ ] `setModuleLevel`
- [ ] `setRoleCaseScope`
- [ ] `listUsersWithRoles`
- [ ] `setUserRole`

**portal** (M8 Portals)

- [ ] `listPortalCases`
- [ ] `getPortalCase`
- [ ] `listPortalDocuments`
- [ ] `getPortalDocumentForDownload`
- [ ] `listPortalMessages`
- [ ] `sendPortalMessage`
- [ ] `listPortalApprovals`
- [ ] `decidePortalApproval`
- [ ] `uploadPortalDocument`
- [ ] `listPortalInvoices`

**procedure-requests** (M2 Core ops)

- [ ] `addProcedureRequest`
- [ ] `cycleProcedureRequestStatus`
- [ ] `deleteProcedureRequest`
- [ ] `listProcedureRequests`

**pulse** (M6 HR)

- [ ] `getPulseRanking`
- [ ] `getEmployeeOfWeek`
- [ ] `getPulseTeamTotals`
- [ ] `getPulseSelfCard`
- [ ] `getPulseDrilldown`
- [ ] `getPerformanceWeights`
- [ ] `setPerformanceWeight`
- [ ] `resetPerformanceWeight`
- [ ] `canViewPulseTeam`

**search** (M2 Core ops)

- [ ] `globalSearch`

**security** (M1 Foundation)

- [ ] `getSecurityStatus`
- [ ] `beginTotpEnroll`
- [ ] `confirmTotpEnroll`
- [ ] `disableTotp`
- [ ] `getOfficeIpAllowlist`
- [ ] `setOfficeIpAllowlist`

**security-audit** (M1 Foundation)

- [ ] `listSecurityAudit`

**settings** (M1 Foundation)

- [ ] `listRecycleBin`
- [ ] `restoreRecycleItem`
- [ ] `purgeRecycleBin`

**tasks** (M2 Core ops)

- [ ] `listTasks`
- [ ] `createTask`
- [ ] `moveTask`
- [ ] `deleteTask`
- [ ] `createAutoTask`

**templates** (M3 Documents)

- [ ] `listTemplates`
- [ ] `getTemplateByKey`
- [ ] `templateFields`

**today** (M2 Core ops)

- [ ] `computeWinRate`
- [ ] `getTodaySummary`

**trust** (M4 Finance)

- [ ] `postTrustMovement`
- [ ] `trustDeposit`
- [ ] `trustWithdraw`
- [ ] `trustTransferToFees`
- [ ] `listTrustAccounts`
- [ ] `getTrustLedger`

## Business rules found inside legacy services

These lived in service files, not in `src/lib`, so a file-level port would miss them.

| Rule | Legacy | New home | Status |
|---|---|---|---|
| `Partner-only actions (8): permissions admin, security audit, IP allowlist, finance require-approval, recycle-bin purge, billing, office branding, start role preview` | legacy PARTNER_ONLY checks | packages/auth partner.ts + API @RequirePartner | ✅ Ported (effective role; real role to start a preview) |
| `Judgment detection (starts the 30-day objection deadline)` | server/hearings.ts isJudgment | packages/rules cases.ts | ✅ Ported |
| `Effective case stage from the latest held hearing` | server/cases.ts effectiveStage | packages/rules cases.ts | ✅ Ported |
| `Promote / remand stage` | server/cases.ts | packages/rules procedural.ts + cases.ts | ✅ Ported |
| `Win rate = (won + ½ partial) / with outcome` | server/today.ts computeWinRate | packages/rules cases.ts winRate | ✅ Ported |
| `Lead, approval, candidate pipelines (bounded moves)` | leads/approvals/hr recruitment | packages/rules workflows.ts | ✅ Ported |
| `Procedure-request and execution-procedure status cycles` | procedure-requests.ts, execution.ts | packages/rules workflows.ts | ✅ Ported |
| `Execution file status after a collection` | execution.ts statusAfterCollection | packages/rules workflows.ts | ✅ Ported |
| `Pulse points per action + office override` | lib/performance.ts | packages/rules performance.ts | ✅ Ported |
| `Normal debit/credit side, period keys` | ledger-reports.ts, finance/ledger.ts, hr/payroll.ts | packages/rules ledger.ts | ✅ Ported |
| `Upload limits (25 MB staff, 20 MB portal) + MIME allowlist` | documents.ts, portal.ts | packages/documents uploads.ts | ✅ Ported |
| `AI system prompts with the closed-KB citation rule` | server/ai.ts | apps/api/src/modules/ai/prompts.ts | ✅ Ported (verbatim) |
| `Auto-task idempotency by autoSignature` | server/tasks.ts createAutoTask | M2 tasks module (unique index on office_id + auto_signature) | ⏳ Pending |
| `Smart alert tiers (overdue → critical, ≤2 days → important, …), filtered by module permission` | server/alerts.ts | M2 alerts module | ⏳ Pending |
| `Security-audit action prefixes (auth., portal.login, portal.otp, security., permission., access.)` | server/security-audit.ts | M1 security module | ⏳ Pending |
| `Activity categories from action/resource` | server/activity.ts categorize | M2 activity module | ⏳ Pending |
| `Fee basis labels + unbilled-time collection` | server/fees.ts | M4 fees module | ⏳ Pending |
| `Journal posting rules for invoice, payment, credit note, bad debt, expense, advance, payroll, trust (deposit/withdraw/transfer)` | invoices.ts, trust.ts, expenses.ts, hr/advances.ts, hr/payroll.ts | packages/rules postings.ts (every builder tested balanced) | ✅ Ported |
| `Standard account codes (ACC) + default chart of accounts (14 accounts)` | lib/finance/ledger.ts, prisma/seed.ts | packages/rules postings.ts ACC, COA_SEED | ✅ Ported |
| `Trust balance can never go negative` | trust.ts conditional decrement | packages/rules canDebitTrust + DB check in M4 | ✅ Ported (rule) |
| `Per-office document numbering (INV-1043…, REC, CN, JV bases)` | lib/finance/ledger.ts nextNumber | packages/rules nextDocNumber (+ unique index + retry in M4) | ✅ Ported (rule) |
| `OTP policy: 6 digits, 5-min TTL, 5 attempts, 30-s resend cooldown, HMAC-stored` | lib/auth/otp.ts, portal-otp.ts, emp-portal-otp.ts | packages/auth otp-policy.ts | ✅ Ported (rules); hashing/sending in M1 |
| `Role preview is view-only: every write blocked, except starting/ending the preview` | lib/permissions/guard.ts requireModule/canAction | packages/auth previewAllows + API PermissionsGuard | ✅ Ported |
| `Objection reminder task due 5 days before the deadline (AUDIT Q11)` | server/hearings.ts | packages/rules objectionReminderDue | ✅ Ported |
| `Credit note blocked when credited, bad debt, or any payment exists` | server/invoices.ts issueCreditNote | packages/rules creditNoteBlocker | ✅ Ported |
| `Advance: installment ≤ amount and never rounds to 0` | server/hr/advances.ts | packages/rules advanceBlocker | ✅ Ported |
| `Approving a leave request needs days + balance, then deducts it` | server/hr/requests.ts decideRequest | packages/rules leaveApprovalBlocker | ✅ Ported (rule); deduction in M6 |
| `Saudization counts every non-terminated employee` | server/hr/saudization.ts | packages/rules countsForSaudization | ✅ Ported |
| `A decided (approved/rejected) HR request is terminal` | server/hr/requests.ts | M6 requests module | ⏳ Pending |
| `Conflict flags: a documented waiver survives re-scans; creating a client/lead re-scans existing cases` | lib/conflict/service.ts | M2 conflicts module | ⏳ Pending |
| `Hearing reminders can recur (reminderRecurDays) and escalate to a task` | server/hearings.ts | M2 hearings module | ⏳ Pending |
| `Integrations start disconnected and are never shown as connected without a real connection` | server/hr/integrations.ts | M7 | ⏳ Pending (owner decision) |
| `Screen → module map + free screens (docs/04 VIEW2MOD/FREE_VIEWS); legacy app-shell nav` | components/app-shell.tsx | packages/auth screens.ts (docs/04 wins on 4 deviations, see AUDIT table) | ✅ Ported |
| `Global search: ≥2 chars, 8 per category, category gated by module, cases/documents/tasks row-scoped` | server/search.ts, shell-frame.tsx | packages/auth SEARCH_CATEGORY_MODULE + packages/contracts search.ts | ✅ Ported (rules); endpoint in M2 |
| `Idle sign-out after 20 minutes (mouse/key/click/scroll/touch)` | components/idle-logout.tsx | packages/auth SESSION_POLICY | ✅ Ported (rule); component in M1 |
| `Service error codes with localized messages (PAYROLL_ALREADY_RUN, PERIOD_LOCKED, …)` | components/hr-ui.tsx ERR_KEYS | packages/contracts error codes per module | ⏳ Pending |
| `Input validation limits (MAX_HALALAS cap, 4000-char text, colour regex, …) in ~60 Zod schemas` | src/server/*.ts | packages/contracts, per module | ⏳ Pending (port each schema with its module) |

## Features visible in legacy history (not separate files)

From the legacy commits. Check each against the rebuilt screen before calling a module done.

| Feature | Legacy commit | Milestone |
|---|---|---|
| Text-only enlargement (text scales, icons/layout don't) | 7ed511a, 4f540f2, 2dac38b | M1 Foundation |
| Topbar live search dropdown: cases, clients, leads, employees | 7b38277, 0ba049e | M2 Core ops |
| Idle logout | 818d093 | M1 Foundation |
| Role preview (معاينة حسب الدور) banner + server-side effective role | 1adfeb3 | M1 Foundation |
| Partner-only gating for /billing and /perms/security (server-side) | 645e92b | M1 Foundation |
| Account security: TOTP enrol/disable, security audit, IP allowlist | 818d093 | M1 Foundation |
| Office branding (letterhead colours/logo) + org chart | 933d4e3 | M1 Foundation |
| Record-hearing wizard (4 steps) incl. pending-hearing note | 7fe9136, d2db07f | M2 Core ops |
| Edit upcoming hearing date + inline wizard actions | eed3634 | M2 Core ops |
| Hearing client report as request → approve/reject workflow | a1fa181 | M2 Core ops |
| Procedural requests linked to the hearing they were raised in | cd6448f | M2 Core ops |
| Auto reminder/task from an execution procedure's follow-up date | 4d501a1 | M2 Core ops |
| Case closing checklist, client satisfaction, referral request, archive | 818d093 | M2 Core ops |
| Case contracts (signed toggle) and case messages | 818d093 | M2 Core ops |
| Approvals chain and execution module design parity | 02bc6da | M2 Core ops |
| Opening package (clearOpeningPackage) and document sharing toggle | e77f010 | M3 Documents |
| Hearing report PDF | e77f010 | M3 Documents |
| Period lock enforced on time entries too | 70590a0 | M4 Finance |
| Trust deposit / withdraw / transfer-to-fees | 2643d04 | M4 Finance |
| Cash-flow statement and per-client statement (كشف حساب العميل) | c669630 | M4 Finance |
| Bank reconciliation: running ledger, cleared/pending | ba118fd | M4 Finance |
| 7 finance screens: dashboard, CoA, journal, ledger, statements, governance, profitability | 19c1080 | M4 Finance |
| Credit notes, bad-debt write-off, VAT return, aging, trial balance | a1cbc30 | M4 Finance |
| Require-approval governance switch for finance | 19c1080 | M4 Finance |
| AI hearing-minutes drafting (rebuild on Vertex + gate) | 1816908 | M5 AI gate |
| HR attendance, recruitment, performance, integrations screens | 9a79a66 | M6 HR |
| Team Pulse: ranking, employee of the week, drill-down, editable weights, self card | 8667426 | M6 HR |
| Employee self-service portal | 7648217 | M8 Portals |
| Client portal: approvals, document upload, invoices | dcc153a | M8 Portals |
| Recycle bin: list, restore, purge (partner) | dbfc200 | M1 Foundation |
| 9 top-level sections from the prototype audit (today, journey, pulse, whatsapp, …) | dbfc200 | M2 Core ops |

## Server actions (29 files)

The form-handling layer between legacy pages and services. Each becomes API endpoints + web forms in its module; check them for parsing/defaulting logic before deleting the legacy screen.

| File | Status | Milestone | Notes |
|---|---|---|---|
| `account/actions.ts` | ⏳ Pending | M1 Foundation |  |
| `ai/actions.ts` | ⏳ Pending | M5 AI gate |  |
| `cases/actions.ts` | ⏳ Pending | M2 Core ops |  |
| `cases/approvals-actions.ts` | ⏳ Pending | M2 Core ops |  |
| `cases/client-approvals-actions.ts` | ⏳ Pending | M2 Core ops |  |
| `cases/closing-actions.ts` | ⏳ Pending | M2 Core ops |  |
| `cases/communication-actions.ts` | ⏳ Pending | M2 Core ops |  |
| `cases/contract-actions.ts` | ⏳ Pending | M2 Core ops |  |
| `cases/edit-actions.ts` | ⏳ Pending | M2 Core ops |  |
| `cases/execution-actions.ts` | ⏳ Pending | M2 Core ops |  |
| `cases/hearing-actions.ts` | ⏳ Pending | M2 Core ops |  |
| `cases/hearing-ai-actions.ts` | ⏳ Pending | M2 Core ops |  |
| `cases/message-actions.ts` | ⏳ Pending | M2 Core ops |  |
| `cases/proc-actions.ts` | ⏳ Pending | M2 Core ops |  |
| `cases/procedure-request-actions.ts` | ⏳ Pending | M2 Core ops |  |
| `clients/actions.ts` | ⏳ Pending | M2 Core ops |  |
| `documents/actions.ts` | ⏳ Pending | M3 Documents |  |
| `documents/upload-actions.ts` | ⏳ Pending | M3 Documents |  |
| `emp-portal/actions.ts` | ⏳ Pending | M8 Portals |  |
| `finance/actions.ts` | ⏳ Pending | M4 Finance |  |
| `finance/trust/actions.ts` | ⏳ Pending | M4 Finance |  |
| `hr/actions.ts` | ⏳ Pending | M6 HR |  |
| `hr/recruitment/actions.ts` | ⏳ Pending | M6 HR |  |
| `leads/actions.ts` | ⏳ Pending | M2 Core ops |  |
| `perms/actions.ts` | ⏳ Pending | M1 Foundation |  |
| `portal/actions.ts` | ⏳ Pending | M8 Portals |  |
| `pulse/actions.ts` | ⏳ Pending | M6 HR |  |
| `settings/actions.ts` | ⏳ Pending | M1 Foundation |  |
| `tasks/actions.ts` | ⏳ Pending | M2 Core ops |  |

## Database uniqueness rules (25)

These constraints are business rules (one fee agreement per case, one payroll run per period, …). Recreate each as a unique index (scoped by `office_id` where the model is tenant data) when the table is ported.

| Model | Unique on | Milestone |
|---|---|---|
| `User` | `officeId, phone` | M1 Foundation |
| `Permission` | `officeId, role, module` | M1 Foundation |
| `FieldPermission` | `officeId, role, resource, field` | M1 Foundation |
| `RoleCaseScope` | `officeId, role` | M1 Foundation |
| `Client` | `officeId, phone` | M2 Core ops |
| `CaseAssignee` | `caseId, userId` | M2 Core ops |
| `Task` | `officeId, autoSignature` | M2 Core ops |
| `ConflictFlag` | `caseId, conflictType, matchedName` | M2 Core ops |
| `NajizClassification` | `mainClass, subClass, caseType` | M2 Core ops |
| `CaseFeeAgreement` | `caseId` | M4 Finance |
| `Invoice` | `officeId, number` | M4 Finance |
| `Payment` | `officeId, number` | M4 Finance |
| `CreditNote` | `invoiceId` | M4 Finance |
| `CreditNote` | `officeId, number` | M4 Finance |
| `TrustAccount` | `clientId` | M4 Finance |
| `ChartOfAccount` | `officeId, code` | M4 Finance |
| `JournalEntry` | `officeId, entryNo` | M4 Finance |
| `AccountingPeriod` | `officeId, periodKey` | M4 Finance |
| `KnowledgeSource` | `citationKey` | M5 AI gate |
| `Employee` | `userId` | M6 HR |
| `IntegrationConnection` | `officeId, key` | M7 Integrations |
| `Attendance` | `officeId, employeeId, date` | M6 HR |
| `PayrollRun` | `officeId, periodKey` | M6 HR |
| `OfficePerformanceWeight` | `officeId, kind` | M6 HR |
| `CaseExecution` | `caseId` | M2 Core ops |

## Audited actions (113)

Every action legacy wrote to the audit log. The rebuilt modules must keep logging each one (PDPL access logging).

`advance.create`, `ai.arena.reset`, `appointment.cancel`, `appointment.create`, `approval.advance`, `approval.create`, `approval.delete`, `approval.reject`, `attendance.clockOut`, `attendance.setStatus`, `bank.toggleCleared`, `candidate.create`, `candidate.delete`, `candidate.move`, `case.archive`, `case.assign`, `case.closingChecklist`, `case.create`, `case.csat`, `case.procEnd`, `case.procReopen`, `case.referral`, `case.setOutcome`, `case.stagePromote`, `case.stageRemand`, `case.unassign`, `case.update`, `case.view`, `client.create`, `client.update`, `clientApproval.create`, `communication.add`, `communication.delete`, `conflict.detected`, `conflict.waived`, `contract.add`, `contract.delete`, `contract.toggleSigned`, `document.clearOpeningPackage`, `document.delete`, `document.download`, `document.generate`, `document.upload`, `empRequest.create`, `empRequest.decide`, `employee.create`, `employee.grantAccount`, `employee.terminate`, `employee.update`, `execution.close`, `execution.collect`, `execution.open`, `execution.status`, `execution.update`, `expense.create`, `expense.reimburse`, `fee.invoice`, `fee.save`, `finance.requireApproval.set`, `hearing.addReminder`, `hearing.addTask`, `hearing.delete`, `hearing.deleteReminder`, `hearing.deleteTask`, `hearing.escalateReminder`, `hearing.record`, `hearing.report.approve`, `hearing.report.cancelApproval`, `hearing.report.reject`, `hearing.report.requestApproval`, `hearing.reportPdf`, `hearing.setNext`, `hearing.update`, `hearing.updateReminder`, `hearing.updateTask`, `integration.connect`, `integration.disconnect`, `integration.sync`, `invoice.badDebt`, `invoice.create`, `invoice.creditNote`, `invoice.payment`, `journal.manualEntry`, `lead.convert`, `lead.create`, `lead.delete`, `lead.move`, `lead.update`, `leave.create`, `message.send`, `office.branding.update`, `payroll.run`, `permission.setCaseScope`, `permission.setLevel`, `permission.setUserRole`, `procedureRequest.add`, `procedureRequest.cycleStatus`, `procedureRequest.delete`, `pulse.resetWeight`, `pulse.setWeight`, `recycle.purge`, `recycle.restore`, `security.ipAllowlist.update`, `security.totp.disable`, `security.totp.enable`, `task.create`, `task.delete`, `task.move`, `time.create`, `time.invoice`, `trust.deposit`, `trust.transferToFees`, `trust.withdraw`

## Seed data

| Seed | Status | Where / milestone |
|---|---|---|
| Chart of accounts (14) | ✅ Ported | packages/rules COA_SEED |
| Najiz taxonomy | ✅ Ported | packages/rules reference/najiz.ts |
| 8 document templates | ✅ Ported | packages/documents templates.ts |
| Permission matrix | ✅ Ported | packages/auth seedPolicy |
| Knowledge base sample sources | ⏳ Pending | M5 (lib/ai/kb-seed.ts) |
| Demo office + 6 role users (0500000001–6) + 2 cases | ⏳ Pending | M1/M2 seed script |

## Owner decisions recorded in legacy

These were written into legacy code comments and commits, not the docs. They are now also in `CLAUDE.md`.

| Date | Decision | Source |
|---|---|---|
| 2026-07-05 | `office_id` on every table from day one (multi-tenant) | prisma/schema.prisma header, AUDIT Q1 |
| 2026-07-24 | The prototype is the binding visual reference for the product chrome and screens (1:1 sizes, radii, colours, spacing); docs stay binding for behaviour and rules | app/globals.css, server/today.ts |
| 2026-07-24 | PDFs are rendered with headless Chrome (puppeteer), an approved stack addition, because server PDF libraries can't shape Arabic/RTL like the preview | lib/pdf/render.ts, commit e77f010 |
| — | No fabricated integrations: show them disconnected rather than mocked | commit dbfc200 |

## AUDIT.md open questions (first-session audit)

Status as implemented in legacy. Anything marked Open still needs the owner's answer.

| # | Question | Legacy behaviour | Status |
|---|---|---|---|
| 1 | Multi-tenancy | `office_id` everywhere | Decided (2026-07-05); now enforced by RLS |
| 2 | Claude on Vertex in me-central2 | stub LLM; dev fallback called api.anthropic.com | **Open** — blocks M5 |
| 3 | users vs employees | employees link to an optional user (grantEmployeeAccount) | Implemented; confirm |
| 4 | Sentry vs PDPL | no Sentry | **Open** — new stack uses Cloud Logging only |
| 5 | OTP provider | console + Unifonic | **Open** — Unifonic vs WhatsApp Business (Buraq/Meta from Alkhalil) |
| 6 | 30-day objection for every case type | fixed 30 days | As documented; confirm urgent tracks |
| 7 | End of service on resignation (Labor Law art. 85) | full award only | **Open** |
| 8 | GOSI rates | manual amount per employee, capped at wage | **Open** |
| 9 | VAT rounding: per line or per invoice | per invoice: round(Σ line nets × 15%) | **Open** — AUDIT suggested per line for ZATCA |
| 10 | Default row scope per role | partner/accountant/admin/reception ALL; lawyer/assistant ASSIGNED | Implemented (seed) |
| 11 | Objection reminder 5 days early | 5 days | Implemented; now in packages/rules |
| 12 | Simplified Nitaqat | simple percentage bands | Implemented; confirm for v1 |
| new | Bad-debt write-off posts the full remainder incl. VAT to expense | VAT stays payable | **Open** — accountant to confirm VAT bad-debt relief |
| new | Screens where legacy deviated from docs/04: dashboard (docs free, legacy REPORTS), kb (docs DOCUMENTS, legacy AI), billing and perms (docs FINANCE/PERMISSIONS, legacy partner-only) | legacy gating | **Open** — new build follows docs/04; billing data and permission changes stay partner-only actions |

## UI behaviours to keep (from legacy components)

| Behaviour | Legacy | Milestone |
|---|---|---|
| Topbar search: live dropdown after 250 ms, Enter opens the full results page, dropdown closes on blur | components/shell-frame.tsx | M2 Core ops |
| Navigation grouped (main, daily, admin, system) and filtered by screen access; 'new case' quick action only with CASES edit and not in preview | components/app-shell.tsx, side-nav.tsx | M1 Foundation |
| Idle sign-out timer reset by activity | components/idle-logout.tsx | M1 Foundation |
| OTP code input: large, centred, letter-spaced digits (staff, portal, employee portal) | components/auth/login-form.tsx and portal forms | M1 Foundation |
| Case list client-side filters: status (active/done), city, category, free-text over title/client/number | components/cases/case-list.tsx | M2 Core ops |
| Cascading Najiz picker (main → sub → case type) | components/cases/najiz-picker.tsx | M2 Core ops |
| Record-hearing wizard: 4 steps, all fields kept mounted, single submit on the last step | components/cases/hearing-wizard.tsx | M2 Core ops |
| Case assignee role picker | components/cases/role-picker.tsx | M2 Core ops |
| Select that submits its form on change (filters) | components/auto-submit-select.tsx | M1 Foundation |
| Finance / HR / permissions tab bars | components/finance-tabs.tsx, hr-tabs.tsx, perms-tabs.tsx | M4 Finance |
| AI answer card: final text + verified source links + blocked-citation count | components/ai-answer.tsx | M5 AI gate |
| Conflict badge on cases | components/conflict-badge.tsx | M2 Core ops |

## Legacy defects to fix, not copy

| Issue | Where | Fix |
|---|---|---|
| AI drafting called api.anthropic.com directly and skipped the citation gate | lib/ai/hearing-draft.ts | Vertex me-central2 + gate (M5) |
| TOTP secret stored in plaintext | User.totpSecret | encrypt at rest (M1) |
| Permission policy cached per process (stale on other Cloud Run instances) | lib/permissions/policy.ts | load per request or shared invalidation (M1) |
| Hard-coded Arabic in 9 components/pages | idle-logout, ai-draft-hearing-button, dashboard, today, hr, payroll, cases/[id], emp-portal | i18n + lint rule (done) |
| Pulse time windows used server-local time | server/pulse.ts sinceFor | Riyadh calendar (packages/rules dates.ts) |
| Overdue invoices / reminders computed only on read | lib/finance/core.ts | outbox + Cloud Tasks jobs |
| OTP HMAC key falls back to an empty AUTH_SECRET | lib/auth/otp.ts hashCode | required secret via env schema (M1) |
| Login reveals whether a phone is registered (USER_NOT_FOUND) | lib/auth/otp.ts | same response either way (M1) |
| A phone registered in two offices cannot log in (resolveUser needs exactly one match) | lib/auth/otp.ts | office picker or per-office login (M1 decision) |
| Money columns are int4 (MAX_HALALAS ≈ 21.47M SAR) | prisma schema | bigint halalas in Drizzle (M4) |

