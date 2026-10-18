# Legacy → new architecture migration tracker

Every file, screen, route and model in `legacy/` with where it went or which milestone owns it, so no feature is lost in the rebuild (ADR-0001). Update this file in the same PR that ports something.

Milestones follow `docs/02` §13. **M1 Foundation** now also includes: staff OTP login, TOTP 2FA, editable permissions (all three layers), office IP allowlist enforcement, and audit writers.

## Summary (Migration tracker)

| Area | Legacy | ✅ Done | Remaining |
|---|---|---|---|
| `src/lib` files | 51 | 41 | 10 |
| Business rules inside services/components | 37 | 30 | 7 |
| Services | 54 | 31 | 23 |
| Service capabilities | 225 | 145 | 80 |
| Screens | 63 | 30 | 33 |
| Components | 20 | 14 | 6 |
| Route handlers | 9 | 4 (+1 replaced) | 4 |
| Models | 56 | 41 (+ `outbox`, `sessions` new) | 15 |
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
| `audit/index.ts` | ✅ Ported | apps/api/src/common/audit/audit.ts | auth events + permission denials written; other modules add theirs |
| `auth/config.ts` | ✅ Ported | apps/api/src/modules/auth (Auth.js replaced by API sessions) | e2e: apps/api/test/api.e2e.test.ts |
| `auth/emp-portal-otp.ts` | ⏳ Pending | M8 Portals | employee-portal OTP |
| `auth/emp-portal-session.ts` | ⏳ Pending | M8 Portals |  |
| `auth/index.ts` | ✅ Ported | apps/api/src/modules/auth/auth.service.ts | OTP + TOTP; same OTP reusable until every check passes |
| `auth/otp-provider.ts` | ✅ Ported | apps/api/src/modules/auth/otp-provider.ts | console (dev) + Unifonic placeholder exactly as legacy (not connected); boot refuses console in production |
| `auth/otp.ts` | ✅ Ported | apps/api/src/modules/auth/auth.service.ts | unknown/ambiguous numbers now get the same response (no enumeration) |
| `auth/phone.ts` | ✅ Ported | packages/rules/src/phone.ts | 2 tests |
| `auth/portal-otp.ts` | ⏳ Pending | M8 Portals | client-portal OTP |
| `auth/portal-session.ts` | ⏳ Pending | M8 Portals |  |
| `auth/role-preview.ts` | ✅ Ported | sessions.preview_role + POST/DELETE /api/v1/permissions/preview | server-side, not a cookie; view-only enforced by the guard |
| `auth/session.ts` | ✅ Ported | apps/api/src/modules/auth/session.service.ts | DB sessions: httpOnly cookie (web) or bearer (mobile); 20-min idle + 30-day limit enforced server-side |
| `auth/totp.ts` | ✅ Ported | apps/api/src/modules/auth/totp.ts | RFC 6238 tests added; encrypt the secret at rest (legacy stored it in plaintext) |
| `auth/types.ts` | ✅ Ported | apps/api/src/common/tenancy/principal.ts |  |
| `case-events.ts` | ✅ Ported | apps/api/src/modules/cases/case-events.ts | stores i18n key + params ("@key" values translated at read), not Arabic text |
| `cities.ts` | ✅ Ported | packages/rules/src/reference/cities.ts |  |
| `conflict/engine.ts` | ✅ Ported | packages/rules/src/conflict.ts | 11 tests |
| `conflict/service.ts` | ✅ Ported | apps/api/src/modules/cases/conflicts.service.ts | stale flags become RESOLVED (not deleted); re-scan also on a case's own new parties |
| `dates.ts` | ✅ Ported | packages/rules/src/dates.ts | 5 tests |
| `db.ts` | ✅ Ported | packages/database createDb/withTenant (RLS) |  |
| `documents/render.ts` | ✅ Ported | packages/documents/src/render.ts | 7 tests (with templates) |
| `documents/template-defs.ts` | ✅ Ported | packages/documents/src/templates.ts |  |
| `finance/core.ts` | ✅ Ported | packages/rules/src/finance.ts | 19 tests |
| `finance/ledger.ts` | ✅ Ported | apps/api/src/modules/finance/ledger.ts | atomic per-office counters (gapless) instead of scan + retry; descriptions as i18n keys |
| `format.ts` | ✅ Ported | packages/rules/src/pii.ts (maskIban) | tests added |
| `hr/core.ts` | ✅ Ported | packages/rules/src/hr.ts | 24 tests; band labels moved to i18n nitaqat.* |
| `i18n/ar.ts` | ✅ Ported | packages/i18n/src/ar.ts | + health/errors/currency keys |
| `i18n/index.ts` | ✅ Ported | packages/i18n/src/index.ts | + en fallback, dirOf, formatSar |
| `labels.ts` | ✅ Ported | packages/i18n (label keys per enum) | packages/i18n/test/coverage.test.ts checks every enum value has a label |
| `money.ts` | ✅ Ported | packages/rules/src/money.ts | 3 tests; formatSar moved to i18n |
| `najiz.ts` | ✅ Ported | packages/rules/src/reference/najiz.ts | tests added |
| `pdf/letterhead.ts` | ✅ Ported | packages/documents/src/letterhead.ts | labels from i18n; CSP forbids any fetch; tested escaping |
| `pdf/render.ts` | ✅ Ported | apps/pdf (separate service: puppeteer, Arabic fonts in the image, token auth, no JS and no network while rendering) + apps/api common/pdf/pdf.client.ts |  |
| `performance.ts` | ⏳ Pending | M6 HR | PERFORMANCE_POINTS ported (packages/rules performance.ts); event log writer pending |
| `permissions/engine.ts` | ✅ Ported | packages/auth/src/engine.ts | 20 tests |
| `permissions/guard.ts` | ✅ Ported | apps/api PermissionsGuard | layer 1 + partner-only + view-only preview, audited; layers 2–3 apply in the cases module (M2) via PolicyService |
| `permissions/matrix.ts` | ✅ Ported | packages/auth/src/matrix.ts + policy.ts (seedPolicy) |  |
| `permissions/policy.ts` | ✅ Ported | apps/api PolicyService + packages/auth policyFromRows | read from the office's rows on every request; no stale cache |
| `permissions/scope.ts` | ✅ Ported | apps/api/src/modules/cases/case-scope.ts | EXISTS(case_assignees) condition on every case query |
| `security/ip.ts` | ✅ Ported | apps/api/src/common/security/ip-allowlist.ts | enforced by the API on login and on every request (legacy enforced it only in the page shell) |
| `storage/gcs.ts` | ✅ Ported | apps/api/src/common/storage/storage.ts GcsStorage (me-central2 bucket; production refuses local disk) |  |
| `storage/index.ts` | ✅ Ported | apps/api/src/common/storage/storage.ts storageFor (STORAGE_DRIVER) |  |
| `storage/local.ts` | ✅ Ported | apps/api/src/common/storage/storage.ts LocalStorage (dev, traversal-safe) |  |
| `storage/types.ts` | ✅ Ported | apps/api/src/common/storage/storage.ts DocumentStorage + documentKey |  |

## `src/server` services (54 files)

All pending: each becomes a NestJS module in `apps/api/src/modules/` that uses `TenantDb` and Zod contracts.

| Service | Status | Milestone | Notes |
|---|---|---|---|
| `activity` | ✅ Ported | apps/api/src/modules/overview |  |
| `ai` | ⏳ Pending | M5 AI gate | assistant + arena — every answer through the citation gate; system prompts ported to apps/api/src/modules/ai/prompts.ts |
| `alerts` | ✅ Ported | apps/api/src/modules/overview (row-scoped; overdue invoices join with M4) |  |
| `appointments` | ✅ Ported | apps/api/src/modules/appointments (+ booking/cancel UI legacy lacked) |  |
| `approvals` | ✅ Ported | apps/api/src/modules/cases/approvals.service.ts (partner step needs CASES at FULL; pending list row-scoped) |  |
| `billing-usage` | ✅ Ported | apps/api/src/modules/billing (GET /billing/usage; live seats, cases, clients, documents) |  |
| `case-profitability` | ⏳ Pending | M4 Finance |  |
| `cases` | ✅ Ported | apps/api/src/modules/cases (effectiveStage follows held hearings) |  |
| `client-approvals` | ✅ Ported | apps/api/src/modules/cases/casework.service.ts (client decides on the portal, M8) |  |
| `clients` | ✅ Ported | apps/api/src/modules/crm (conflict re-scan on rename joins with cases, M2 slice 2) |  |
| `communications` | ✅ Ported | apps/api/src/modules/cases/casework.service.ts (WhatsApp log view joins with M7) |  |
| `contracts` | ✅ Ported | apps/api/src/modules/cases/casework.service.ts |  |
| `dashboard` | ✅ Ported | apps/api/src/modules/overview |  |
| `deadlines` | ✅ Ported | apps/api/src/modules/cases/deadlines.service.ts (GET /deadlines) |  |
| `documents` | ✅ Ported | apps/api/src/modules/documents (uploads checked against file content; template generation; hearing report PDF) |  |
| `emp-portal` | ⏳ Pending | M8 Portals |  |
| `execution` | ✅ Ported | apps/api/src/modules/cases/execution.service.ts (row-locked collections; office-checked follow-up assignee) |  |
| `expenses` | ⏳ Pending | M4 Finance |  |
| `fees` | ✅ Ported | apps/api/src/modules/finance/fees.service.ts (hourly time claimed atomically: billed once) |  |
| `finance-bank` | ⏳ Pending | M4 Finance |  |
| `finance-dashboard` | ⏳ Pending | M4 Finance |  |
| `finance-governance` | ⏳ Pending | M4 Finance |  |
| `hearings` | ✅ Ported | apps/api/src/modules/cases/hearings.service.ts + hearings.controller.ts |  |
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
| `invoices` | ✅ Ported | apps/api/src/modules/finance/invoices.service.ts (invoice row locked for payments/credit notes/write-offs) |  |
| `journey` | ✅ Ported | apps/api/src/modules/overview (invoice and WhatsApp counts join with M4/M7) |  |
| `leads` | ✅ Ported | apps/api/src/modules/crm (incl. convertLead) |  |
| `ledger-reports` | ⏳ Pending | M4 Finance | normal-side balance ported (packages/rules ledger.ts) |
| `messages` | ✅ Ported | apps/api/src/modules/cases/casework.service.ts (client side with the portal, M8) |  |
| `notifications` | ✅ Ported | apps/api/src/modules/overview (+ GET /notifications/count for the bell; invoices join with M4) |  |
| `office-settings` | ✅ Ported | apps/api/src/modules/offices (GET/PUT /offices/branding) |  |
| `permissions-admin` | ✅ Ported | apps/api/src/modules/permissions |  |
| `portal` | ⏳ Pending | M8 Portals |  |
| `procedure-requests` | ✅ Ported | apps/api/src/modules/cases/procedure-requests.service.ts |  |
| `pulse` | ⏳ Pending | M6 HR | points + override rule ported (packages/rules performance.ts); legacy sinceFor() used server-local time, use Riyadh time (dates.ts) |
| `search` | ✅ Ported | apps/api/src/modules/overview (GET /search; documents M3, invoices M4, employees M6) |  |
| `security` | ✅ Ported | apps/api/src/modules/security |  |
| `security-audit` | ✅ Ported | apps/api/src/modules/permissions (GET /permissions/audit) |  |
| `settings` | ⏳ Pending | M1 Foundation | recycle bin: GET /recycle exists (per-module view filter); kinds, restore and purge register with cases/leads (M2), documents (M3), employees (M6) |
| `tasks` | ✅ Ported | apps/api/src/modules/tasks |  |
| `templates` | ✅ Ported | apps/api/src/modules/documents (system templates are code: packages/documents TEMPLATE_DEFS) |  |
| `today` | ✅ Ported | apps/api/src/modules/overview (HR requests and employee of the week join with M6) |  |
| `trust` | ✅ Ported | apps/api/src/modules/finance/trust.service.ts (append-only movements; DB CHECK keeps balance >= 0) |  |

## Screens (63 pages)

All pending in `apps/web` (and later `apps/mobile`), built on the API through `@murafaa/sdk`. Only the status page exists today.

| Route | Status | Milestone | Notes |
|---|---|---|---|
| `/` | ✅ Ported | apps/web/src/app/page.tsx (redirects to /today) |  |
| `/account/security` | ✅ Ported | apps/web/src/app/(app)/account/security |  |
| `/activity` | ✅ Ported | apps/web/src/app/(app)/activity |  |
| `/ai` | ⏳ Pending | M5 AI gate |  |
| `/ai/arena/[caseId]` | ⏳ Pending | M5 AI gate |  |
| `/ai/kb` | ⏳ Pending | M5 AI gate |  |
| `/alerts` | ✅ Ported | apps/web/src/app/(app)/alerts |  |
| `/appointments` | ✅ Ported | apps/web/src/app/(app)/appointments |  |
| `/billing` | ✅ Ported | apps/web/src/app/(app)/billing |  |
| `/cases` | ✅ Ported | apps/web/src/app/(app)/cases (list + filters) |  |
| `/cases/[id]` | ✅ Ported | apps/web/src/app/(app)/cases/[id] — overview (+ procedural requests), hearings, parties (+ contact log), chat, contracts, approvals (+ client approvals), execution, events, closing; assistant, documents, finance tabs with M3–M5 |  |
| `/cases/new` | ✅ Ported | apps/web/src/app/(app)/cases/new |  |
| `/clients` | ✅ Ported | apps/web/src/app/(app)/clients (+ CRM KPIs) |  |
| `/dashboard` | ✅ Ported | apps/web/src/app/(app)/dashboard |  |
| `/deadlines` | ✅ Ported | apps/web/src/app/(app)/deadlines |  |
| `/documents` | ✅ Ported | apps/web/src/app/(app)/documents (template list) |  |
| `/documents/new/[key]` | ✅ Ported | apps/web/src/app/(app)/documents/new/[key] (prefilled from the case, fee fields hidden for denied roles) |  |
| `/emp-portal/(app)` | ⏳ Pending | M8 Portals |  |
| `/emp-portal/login` | ⏳ Pending | M8 Portals |  |
| `/finance` | ✅ Ported | apps/web/src/app/(app)/finance (invoices + new-invoice form from the prototype) |  |
| `/finance/[id]` | ✅ Ported | apps/web/src/app/(app)/finance/[id] |  |
| `/finance/bank` | ⏳ Pending | M4 Finance |  |
| `/finance/coa` | ⏳ Pending | M4 Finance |  |
| `/finance/dashboard` | ⏳ Pending | M4 Finance |  |
| `/finance/expenses` | ⏳ Pending | M4 Finance |  |
| `/finance/governance` | ⏳ Pending | M4 Finance |  |
| `/finance/journal` | ⏳ Pending | M4 Finance |  |
| `/finance/ledger` | ⏳ Pending | M4 Finance |  |
| `/finance/profitability` | ⏳ Pending | M4 Finance |  |
| `/finance/statements` | ⏳ Pending | M4 Finance |  |
| `/finance/trust` | ✅ Ported | apps/web/src/app/(app)/finance/trust |  |
| `/finance/trust/[clientId]` | ✅ Ported | apps/web/src/app/(app)/finance/trust/[clientId] |  |
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
| `/journey` | ✅ Ported | apps/web/src/app/(app)/journey |  |
| `/leads` | ✅ Ported | apps/web/src/app/(app)/leads (pipeline incl. convert) |  |
| `/login` | ✅ Ported | apps/web/src/app/login (+ components/auth/login-form.tsx) |  |
| `/notifications` | ✅ Ported | apps/web/src/app/(app)/notifications (+ bell count) |  |
| `/perms` | ✅ Ported | apps/web/src/app/(app)/perms (matrix + role preview) |  |
| `/perms/audit` | ✅ Ported | apps/web/src/app/(app)/perms/audit |  |
| `/perms/security` | ✅ Ported | apps/web/src/app/(app)/perms/security |  |
| `/perms/users` | ✅ Ported | apps/web/src/app/(app)/perms/users |  |
| `/portal/(app)` | ⏳ Pending | M8 Portals |  |
| `/portal/(app)/cases/[id]` | ⏳ Pending | M8 Portals |  |
| `/portal/(app)/invoices` | ⏳ Pending | M8 Portals |  |
| `/portal/login` | ⏳ Pending | M8 Portals |  |
| `/pulse` | ⏳ Pending | M6 HR |  |
| `/search` | ✅ Ported | apps/web/src/app/(app)/search (+ topbar dropdown) |  |
| `/settings` | ✅ Ported | apps/web/src/app/(app)/settings (branding, recycle bin, account) |  |
| `/tasks` | ✅ Ported | apps/web/src/app/(app)/tasks (kanban) |  |
| `/today` | ✅ Ported | apps/web/src/app/(app)/today |  |
| `/whatsapp` | ⏳ Pending | M7 Integrations |  |

## Route handlers (9)

| Route | Status | Milestone | Notes |
|---|---|---|---|
| `api/auth/2fa-status` | ⛔ Not ported | — | replaced by the TOTP_REQUIRED answer after a correct OTP, so 2FA status is not exposed before the code |
| `api/auth/[...nextauth]` | ✅ Ported | POST /api/v1/auth/verify, GET /auth/me, POST /auth/logout |  |
| `api/auth/otp` | ✅ Ported | POST /api/v1/auth/otp |  |
| `api/documents/[id]/download` | ✅ Ported | GET /api/v1/documents/:id/download (streamed through the API, audited; no bucket URL) |  |
| `api/emp-portal-auth/otp` | ⏳ Pending | M8 Portals |  |
| `api/emp-portal-auth/verify` | ⏳ Pending | M8 Portals |  |
| `api/portal-auth/otp` | ⏳ Pending | M8 Portals |  |
| `api/portal-auth/verify` | ⏳ Pending | M8 Portals |  |
| `api/search` | ✅ Ported | GET /api/v1/search |  |

## Prisma models (56) → Drizzle tables

New tables need `office_id` + RLS policy + FORCE RLS + grants (see `docs/DEVELOPMENT.md`). Enums used by rules already live in `packages/rules`, `packages/auth` and `packages/documents`.

| Model | Status | Where / milestone | Notes |
|---|---|---|---|
| `Office` | ✅ Ported | packages/database offices (+ ip_allowlist) |  |
| `User` | ✅ Ported | packages/database users (+ encrypted TOTP) |  |
| `OtpChallenge` | ✅ Ported | packages/database otp_challenges |  |
| `Permission` | ✅ Ported | packages/database permissions |  |
| `FieldPermission` | ✅ Ported | packages/database field_permissions |  |
| `RoleCaseScope` | ✅ Ported | packages/database role_case_scopes |  |
| `Client` | ✅ Ported | packages/database clients |  |
| `Case` | ✅ Ported | packages/database cases |  |
| `CaseAssignee` | ✅ Ported | packages/database case_assignees (the only DELETE grant: join table) |  |
| `AuditLog` | ✅ Ported | packages/database audit_log (append-only) |  |
| `Hearing` | ✅ Ported | packages/database hearings (one UPCOMING per case, partial unique index) |  |
| `CaseEvent` | ✅ Ported | packages/database case_events (i18n key + params) |  |
| `CaseReminder` | ✅ Ported | packages/database case_reminders |  |
| `Lead` | ✅ Ported | packages/database leads (expected_value bigint halalas) |  |
| `Task` | ✅ Ported | packages/database tasks (unique office_id + auto_signature) |  |
| `Appointment` | ✅ Ported | packages/database appointments |  |
| `ConflictFlag` | ✅ Ported | packages/database conflict_flags (+ RESOLVED status) |  |
| `NajizClassification` | ✅ Ported | packages/rules reference/najiz.ts (static reference data, not a table) |  |
| `DocumentTemplate` | ✅ Ported | packages/documents TEMPLATE_DEFS (system templates as code; office-owned templates would need a table: owner question) |  |
| `Document` | ✅ Ported | packages/database documents (+ sha256; template key instead of a template row) |  |
| `CaseFeeAgreement` | ✅ Ported | packages/database case_fee_agreements |  |
| `Invoice` | ✅ Ported | packages/database invoices (CHECK total = net + vat) |  |
| `InvoiceItem` | ✅ Ported | packages/database invoice_items (insert-only) |  |
| `Payment` | ✅ Ported | packages/database payments |  |
| `CreditNote` | ✅ Ported | packages/database credit_notes (insert-only) |  |
| `Expense` | ✅ Ported | packages/database expenses (services in M4 slice 2) |  |
| `TimeEntry` | ✅ Ported | packages/database time_entries |  |
| `TrustAccount` | ✅ Ported | packages/database trust_accounts (CHECK balance >= 0) |  |
| `TrustTransaction` | ✅ Ported | packages/database trust_transactions (insert-only) |  |
| `ChartOfAccount` | ✅ Ported | packages/database chart_of_accounts (seeded on first posting) |  |
| `JournalEntry` | ✅ Ported | packages/database journal_entries (insert-only, + doc_counters) |  |
| `JournalLine` | ✅ Ported | packages/database journal_lines (insert-only, + office_id, CHECK one side) |  |
| `AccountingPeriod` | ✅ Ported | packages/database accounting_periods |  |
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
| `CaseApproval` | ✅ Ported | packages/database case_approvals |  |
| `ClientApprovalRequest` | ✅ Ported | packages/database client_approval_requests |  |
| `ProcedureRequest` | ✅ Ported | packages/database procedure_requests |  |
| `ClientCommunication` | ✅ Ported | packages/database client_communications |  |
| `CaseMessage` | ✅ Ported | packages/database case_messages (insert-only grant) |  |
| `Contract` | ✅ Ported | packages/database contracts |  |
| `CaseExecution` | ✅ Ported | packages/database case_executions (one live file per case, unique index) |  |
| `ExecutionProcedure` | ✅ Ported | packages/database execution_procedures (+ office_id, legacy lacked it) |  |

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
| `app-shell.tsx` | ✅ Ported | apps/web/src/components/shell/app-shell.tsx + nav.ts (bell count from /notifications/count) |  |
| `auth/login-form.tsx` | ✅ Ported | apps/web/src/components/auth/login-form.tsx |  |
| `auto-submit-select.tsx` | ✅ Ported | apps/web/src/components/auto-submit-select.tsx |  |
| `cases/ai-draft-hearing-button.tsx` | ⏳ Pending | M5 AI gate |  |
| `cases/case-list.tsx` | ✅ Ported | apps/web/src/components/cases/case-list.tsx |  |
| `cases/hearing-wizard.tsx` | ✅ Ported | apps/web/src/components/cases/hearings.tsx RecordHearingWizard |  |
| `cases/najiz-picker.tsx` | ✅ Ported | apps/web/src/components/cases/case-form.tsx |  |
| `cases/role-picker.tsx` | ✅ Ported | apps/web/src/components/cases/case-form.tsx |  |
| `conflict-badge.tsx` | ✅ Ported | apps/web/src/components/cases/conflict-badge.tsx |  |
| `emp-portal/emp-portal-login-form.tsx` | ⏳ Pending | M8 Portals |  |
| `finance-tabs.tsx` | ✅ Ported | apps/web/src/components/finance/finance-tabs.tsx |  |
| `hr-tabs.tsx` | ⏳ Pending | M6 HR |  |
| `hr-ui.tsx` | ⏳ Pending | M6 HR |  |
| `icons.tsx` | ✅ Ported | apps/web/src/components/icons.tsx |  |
| `idle-logout.tsx` | ✅ Ported | apps/web/src/components/shell/idle-logout.tsx |  |
| `perms-tabs.tsx` | ✅ Ported | apps/web/src/components/perms/perms-tabs.tsx |  |
| `portal/portal-login-form.tsx` | ⏳ Pending | M8 Portals |  |
| `shell-frame.tsx` | ✅ Ported | apps/web/src/components/shell/shell-frame.tsx (live search) |  |
| `side-nav.tsx` | ✅ Ported | apps/web/src/components/shell/side-nav.tsx |  |

## Scripts (7)

| Script | Status | Where / milestone | Notes |
|---|---|---|---|
| `otp-check.ts` | ⛔ Not ported | — | replaced by e2e tests in CI |
| `phase2-check.ts` | ⛔ Not ported | — | replaced by e2e tests in CI |
| `phase3-check.ts` | ⛔ Not ported | — | replaced by e2e tests in CI |
| `phase4-check.ts` | ⛔ Not ported | — | replaced by e2e tests in CI |
| `phase5-check.ts` | ⛔ Not ported | — | replaced by e2e tests in CI |
| `phase6-check.ts` | ⛔ Not ported | — | replaced by e2e tests in CI |
| `reset-dev-data.ts` | ✅ Ported | packages/database/src/reset-dev.ts (`pnpm db:reset`, local databases only) |  |

## Other

| Item | Status | Where / milestone | Notes |
|---|---|---|---|
| `src/middleware.ts` | ✅ Ported | apps/web/src/proxy.ts | navigation redirects only; the API authorizes |
| `src/app/globals.css (component classes)` | ✅ Ported | apps/web/src/app/globals.css | prototype 1:1 classes ported verbatim; tokens in @theme |
| `prisma/seed.ts` | ✅ Ported | packages/database/src/seed.ts (`pnpm db:seed`, runs as the app role) |  |
| `src/app/layout.tsx (root: fonts, RTL, metadata)` | ✅ Ported | apps/web/src/app/layout.tsx |  |
| `src/app/portal/(app)/layout.tsx (client-portal shell)` | ⏳ Pending | M8 Portals |  |
| `src/app/emp-portal/(app)/layout.tsx (employee-portal shell)` | ⏳ Pending | M8 Portals |  |
| `prisma/migrations (35)` | ⛔ Not ported | — | history only; the Drizzle schema is rebuilt table by table |

## Capability checklist (225 exported service functions)

Every capability the legacy services expose. Tick each one when its API endpoint (and test) exists. A rebuilt module is not done until all of its boxes are ticked.

**activity** (M2 Core ops)

- [x] `listActivity`
- [x] `listActivityActors`
- [x] `countActivityByCategory`

**ai** (M5 AI gate)

- [ ] `askAssistant`
- [ ] `runArenaTurn`
- [ ] `getArenaState`
- [ ] `runArenaRound`
- [ ] `resetArena`
- [ ] `listInteractions`
- [ ] `listKnowledgeSources`

**alerts** (M2 Core ops)

- [x] `getSmartAlerts`

**appointments** (M2 Core ops)

- [x] `listAppointments`
- [x] `createAppointment`
- [x] `cancelAppointment`

**approvals** (M2 Core ops)

- [x] `listApprovals`
- [x] `listPendingApprovals`
- [x] `createApproval`
- [x] `advanceApproval`
- [x] `deleteApproval`
- [x] `rejectApproval`

**billing-usage** (M1 Foundation)

- [x] `getBillingUsage`

**case-profitability** (M4 Finance)

- [ ] `getCaseProfitability`

**cases** (M2 Core ops)

- [x] `effectiveStage`
- [x] `listCases`
- [x] `listAssignableUsers`
- [x] `getCase`
- [x] `createCase`
- [x] `updateCase`
- [x] `setCaseOutcome`
- [x] `assignUser`
- [x] `unassignUser`
- [x] `promoteStage`
- [x] `remandStage`
- [x] `endProcedure`
- [x] `reopenProcedure`
- [x] `toggleClosingChecklistItem`
- [x] `setClientSatisfaction`
- [x] `requestReferral`
- [x] `archiveCase`

**client-approvals** (M8 Portals)

- [x] `listClientApprovals`
- [x] `createClientApprovalRequest`

**clients** (M2 Core ops)

- [x] `listClients`
- [x] `createClient`
- [x] `updateClient`

**communications** (M2 Core ops)

- [x] `addClientCommunication`
- [x] `deleteClientCommunication`
- [x] `listClientCommunications`
- [ ] `listMessageCommunications`

**contracts** (M3 Documents)

- [x] `addContract`
- [x] `toggleContractSigned`
- [x] `deleteContract`
- [x] `listContracts`

**dashboard** (M2 Core ops)

- [x] `getDashboardSummary`

**deadlines** (M2 Core ops)

- [x] `getDeadlines`

**documents** (M3 Documents)

- [x] `prepareGenerateForm`
- [x] `generateFromTemplate`
- [x] `uploadDocument`
- [x] `listDocuments`
- [x] `getDocumentForDownload`
- [x] `toggleShare`
- [x] `softDeleteDocument`
- [x] `clearOpeningPackage`
- [x] `generateHearingReportPdf`

**emp-portal** (M8 Portals)

- [ ] `getEmpPortalProfile`
- [ ] `listMyRequests`
- [ ] `submitEmpRequest`

**execution** (M2 Core ops)

- [x] `getExecution`
- [x] `openExecution`
- [x] `updateExecution`
- [x] `setExecutionStatus`
- [x] `closeExecution`
- [x] `recordCollection`
- [x] `addExecutionProcedure`
- [x] `updateExecutionProcedure`
- [x] `deleteExecutionProcedure`
- [x] `cycleExecutionProcedure`

**expenses** (M4 Finance)

- [ ] `createExpense`
- [ ] `listExpenses`
- [ ] `reimburseExpense`
- [x] `createTimeEntry`
- [x] `listTimeEntries`
- [x] `invoiceTimeEntry`

**fees** (M4 Finance)

- [x] `getFeeAgreement`
- [x] `saveFeeAgreement`
- [x] `generateInvoiceFromFee`

**finance-bank** (M4 Finance)

- [ ] `getBankSummary`
- [ ] `getBankLedger`
- [ ] `toggleBankLineCleared`

**finance-dashboard** (M4 Finance)

- [ ] `getFinanceDashboard`

**finance-governance** (M4 Finance)

- [x] `listRecentPeriods`
- [x] `setPeriodLock`
- [ ] `getRequireApproval`
- [ ] `setRequireApproval`
- [ ] `listFinanceAudit`

**hearings** (M2 Core ops)

- [x] `recordHearing`
- [x] `setNextHearing`
- [x] `updateHearing`
- [x] `deleteHearing`
- [x] `addHearingReminder`
- [x] `addHearingTask`
- [x] `requestReportApproval`
- [x] `cancelReportApprovalRequest`
- [x] `decideReportApproval`
- [x] `escalateHearingReminder`
- [x] `updateHearingReminder`
- [x] `deleteHearingReminder`
- [x] `updateHearingTask`
- [x] `deleteHearingTask`
- [x] `getHearingActions`

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

- [x] `createInvoiceInTx`
- [x] `createInvoice`
- [x] `recordPayment`
- [x] `issueCreditNote`
- [x] `writeOffBadDebt`
- [x] `listInvoices`
- [x] `listInvoicesByClient`
- [x] `getInvoice`

**journey** (M2 Core ops)

- [x] `getJourneySummary`

**leads** (M2 Core ops)

- [x] `listLeads`
- [x] `getLeadsKpis`
- [x] `createLead`
- [x] `updateLead`
- [x] `deleteLead`
- [x] `moveLead`
- [x] `convertLead`

**ledger-reports** (M4 Finance)

- [ ] `trialBalance`
- [ ] `agingReport`
- [ ] `vatReturn`
- [x] `listJournal`
- [ ] `getFinancialStatements`
- [ ] `getCashFlowStatement`
- [x] `listAccounts`
- [ ] `createManualJournalEntry`

**messages** (M2 Core ops)

- [x] `sendCaseMessage`
- [x] `listCaseMessages`

**notifications** (M2 Core ops)

- [x] `getNotifications`

**office-settings** (M1 Foundation)

- [x] `getOfficeBranding`
- [x] `updateOfficeBranding`

**permissions-admin** (M1 Foundation)

- [x] `getRoleMatrix`
- [x] `setModuleLevel`
- [x] `setRoleCaseScope`
- [x] `listUsersWithRoles`
- [x] `setUserRole`

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

- [x] `addProcedureRequest`
- [x] `cycleProcedureRequestStatus`
- [x] `deleteProcedureRequest`
- [x] `listProcedureRequests`

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

- [x] `globalSearch`

**security** (M1 Foundation)

- [x] `getSecurityStatus`
- [x] `beginTotpEnroll`
- [x] `confirmTotpEnroll`
- [x] `disableTotp`
- [x] `getOfficeIpAllowlist`
- [x] `setOfficeIpAllowlist`

**security-audit** (M1 Foundation)

- [x] `listSecurityAudit`

**settings** (M1 Foundation)

- [x] `listRecycleBin`
- [x] `restoreRecycleItem`
- [ ] `purgeRecycleBin`

**tasks** (M2 Core ops)

- [x] `listTasks`
- [x] `createTask`
- [x] `moveTask`
- [x] `deleteTask`
- [x] `createAutoTask`

**templates** (M3 Documents)

- [x] `listTemplates`
- [x] `getTemplateByKey`
- [x] `templateFields`

**today** (M2 Core ops)

- [x] `computeWinRate`
- [x] `getTodaySummary`

**trust** (M4 Finance)

- [x] `postTrustMovement`
- [x] `trustDeposit`
- [x] `trustWithdraw`
- [x] `trustTransferToFees`
- [x] `listTrustAccounts`
- [x] `getTrustLedger`

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
| `Auto-task idempotency by autoSignature` | server/tasks.ts createAutoTask | apps/api tasks createAuto (unique index on office_id + auto_signature, ON CONFLICT DO NOTHING) | ✅ Ported (e2e) |
| `Smart alert tiers (overdue → critical, ≤2 days → important, …), filtered by module permission` | server/alerts.ts | packages/rules overview.ts deadlineAlertTier + apps/api overview | ✅ Ported (e2e; scoped to the caller's cases) |
| `Security-audit action prefixes (auth., portal.login, portal.otp, security., permission., access.)` | server/security-audit.ts | M1 security module | ⏳ Pending |
| `Activity categories from action/resource` | server/activity.ts categorize | packages/rules overview.ts activityCategory | ✅ Ported |
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
| `Conflict flags: a documented waiver survives re-scans; creating a client/lead re-scans existing cases` | lib/conflict/service.ts | apps/api cases/conflicts.service.ts | ✅ Ported (e2e) |
| `Hearing reminders can recur (reminderRecurDays) and escalate to a task` | server/hearings.ts | apps/api hearings: escalate, and a pending hearing keeps one recurring reminder (prototype; legacy only stored the interval). Rolling the due date forward needs the Cloud Scheduler jobs runner | 🟡 Partial |
| `Integrations start disconnected and are never shown as connected without a real connection` | server/hr/integrations.ts | M7 | ⏳ Pending (owner decision) |
| `Screen → module map + free screens (docs/04 VIEW2MOD/FREE_VIEWS); legacy app-shell nav` | components/app-shell.tsx | packages/auth screens.ts (docs/04 wins on 4 deviations, see AUDIT table) | ✅ Ported |
| `Global search: ≥2 chars, 8 per category, category gated by module, cases/documents/tasks row-scoped` | server/search.ts, shell-frame.tsx | packages/auth SEARCH_CATEGORY_MODULE + apps/api overview search | ✅ Ported (e2e; % and _ taken literally) |
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
| Recycle bin: list, restore, purge (partner) — list endpoint + panel done; kinds arrive with their modules | dbfc200 | M2 Core ops |
| 9 top-level sections from the prototype audit (today, journey, pulse, whatsapp, …) | dbfc200 | M2 Core ops |

## Server actions (29 files)

The form-handling layer between legacy pages and services. Each becomes API endpoints + web forms in its module; check them for parsing/defaulting logic before deleting the legacy screen.

| File | Status | Milestone | Notes |
|---|---|---|---|
| `account/actions.ts` | ✅ Ported | apps/api /security endpoints |  |
| `ai/actions.ts` | ⏳ Pending | M5 AI gate |  |
| `cases/actions.ts` | ✅ Ported | apps/api /cases endpoints |  |
| `cases/approvals-actions.ts` | ✅ Ported | apps/api /cases/:id/approvals endpoints |  |
| `cases/client-approvals-actions.ts` | ✅ Ported | apps/api /cases/:id/client-approvals endpoints |  |
| `cases/closing-actions.ts` | ✅ Ported | apps/api /cases/:id outcome, closing checklist, satisfaction, referral, archive |  |
| `cases/communication-actions.ts` | ✅ Ported | apps/api /cases/:id/communications endpoints |  |
| `cases/contract-actions.ts` | ✅ Ported | apps/api /cases/:id/contracts endpoints |  |
| `cases/edit-actions.ts` | ✅ Ported | apps/api PATCH /cases/:id |  |
| `cases/execution-actions.ts` | ✅ Ported | apps/api /cases/:id/execution endpoints |  |
| `cases/hearing-actions.ts` | ✅ Ported | apps/api /cases/:id/hearings endpoints |  |
| `cases/hearing-ai-actions.ts` | ⏳ Pending | M5 AI gate |  |
| `cases/message-actions.ts` | ✅ Ported | apps/api /cases/:id/messages endpoints |  |
| `cases/proc-actions.ts` | ✅ Ported | apps/api /cases/:id/stage/promote|remand, /procedure/end|reopen |  |
| `cases/procedure-request-actions.ts` | ✅ Ported | apps/api /cases/:id/procedure-requests endpoints |  |
| `clients/actions.ts` | ✅ Ported | apps/api /clients endpoints |  |
| `documents/actions.ts` | ✅ Ported | apps/api /documents/generate, /documents/:id/share, DELETE /documents/:id, /cases/:id/documents/clear-opening |  |
| `documents/upload-actions.ts` | ✅ Ported | apps/api POST /cases/:id/documents (raw bytes + query metadata) |  |
| `emp-portal/actions.ts` | ⏳ Pending | M8 Portals |  |
| `finance/actions.ts` | ⏳ Pending | M4 Finance |  |
| `finance/trust/actions.ts` | ✅ Ported | apps/api POST /finance/trust/:clientId/movements |  |
| `hr/actions.ts` | ⏳ Pending | M6 HR |  |
| `hr/recruitment/actions.ts` | ⏳ Pending | M6 HR |  |
| `leads/actions.ts` | ✅ Ported | apps/api /leads endpoints |  |
| `perms/actions.ts` | ✅ Ported | apps/api /permissions endpoints |  |
| `portal/actions.ts` | ⏳ Pending | M8 Portals |  |
| `pulse/actions.ts` | ⏳ Pending | M6 HR |  |
| `settings/actions.ts` | ✅ Ported | apps/api /offices/branding, /recycle |  |
| `tasks/actions.ts` | ✅ Ported | apps/api /tasks endpoints |  |

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
| Demo office + 6 role users (0500000001–6) | ✅ Ported | packages/database/src/seed.ts (`pnpm db:seed`) |
| Demo cases (2) | ✅ Ported | apps/api/scripts/seed-demo.ts (`pnpm db:seed:demo`, through the real API: 4 cases with HIGH/MEDIUM conflicts, hearings, tasks, appointments) |

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
| TOTP secret stored in plaintext | User.totpSecret | ✅ fixed: AES-256-GCM (users.totp_secret_enc) |
| Permission policy cached per process (stale on other Cloud Run instances) | lib/permissions/policy.ts | ✅ fixed: read per request |
| Demoting the last partner threw an unhandled LAST_PARTNER error (page crash); two concurrent demotions could both pass the count | server/permissions-admin.ts | ✅ fixed: 409 with errors.LAST_PARTNER, partner rows locked during the check |
| Hard-coded Arabic in 9 components/pages | idle-logout, ai-draft-hearing-button, dashboard, today, hr, payroll, cases/[id], emp-portal | i18n + lint rule (done) |
| Pulse time windows used server-local time | server/pulse.ts sinceFor | Riyadh calendar (packages/rules dates.ts) |
| Overdue invoices / reminders computed only on read | lib/finance/core.ts | outbox + Cloud Tasks jobs |
| OTP HMAC key falls back to an empty AUTH_SECRET | lib/auth/otp.ts hashCode | ✅ fixed: AUTH_SECRET required (≥32 chars) at boot |
| Login reveals whether a phone is registered (USER_NOT_FOUND) and whether it has 2FA (2fa-status) | lib/auth/otp.ts, api/auth/2fa-status | ✅ fixed: same answer for every number; 2FA is asked only after a correct OTP |
| IP allowlist enforced only when rendering the page shell, not on actions | components/app-shell.tsx | ✅ fixed: enforced by the API on every request |
| A phone registered in two offices cannot log in (resolveUser needs exactly one match) | lib/auth/otp.ts | office picker or per-office login (M1 decision) |
| Money columns are int4 (MAX_HALALAS ≈ 21.47M SAR) | prisma schema | bigint halalas in Drizzle (M4) |
| TOTP could be disabled without a code; the enrolment secret round-tripped through the browser | server/security.ts | ✅ fixed: disabling needs a current code; pending secret stored encrypted server-side for 10 min |
| IP allowlist saved without validation; a partner could lock the office out with one save | server/security.ts | ✅ fixed: entries validated, and a list excluding the caller's own address is refused |
| Recycle bin listed every deleted case/lead/document/employee to every user | server/settings.ts | ✅ fixed by design: each kind filtered by its module's view permission |
| Converted leads showed up in the recycle bin (conversion soft-deletes them) | server/settings.ts | ✅ fixed: converted leads excluded |
| Creating case B whose opponent is case A's client never flagged case A (only the saved case was checked) | server/cases.ts createCase | ✅ fixed: re-scan by the new case's opponent and client names |
| A converted lead's case had no assignee, so an ASSIGNED-scope converter couldn't see it | server/leads.ts convertLead | ✅ fixed: converter assigned |
| Unassigning took the removed user's name from the form (spoofable timeline text) | app/cases/actions.ts | ✅ fixed: name read from the database |
| Timeline events stored Arabic display text | lib/case-events.ts | ✅ fixed: i18n key + params |
| An out-of-scope case view was audited inside the failing request transaction | lib/permissions/scope.ts | ✅ fixed: audited in its own transaction (access.case.scope) |
| An invalid client/lead phone was silently dropped; a duplicate client phone crashed the page (unique violation) | server/clients.ts, leads.ts | ✅ fixed: field error auth.error.phoneInvalid; 409 errors.CLIENT_PHONE_TAKEN |
| Hearing/procedural-request/execution assignees were not checked against the office | server/hearings.ts, execution.ts | ✅ fixed: assignee verified through an RLS read (field error) |
| Two concurrent "next hearing" saves could leave two upcoming hearings | server/hearings.ts | ✅ fixed: partial unique index, one UPCOMING per case |
| Smart alerts named every conflicted or empty case in the office, also cases outside the caller's scope | server/alerts.ts | ✅ fixed: alert sources row-scoped |
| Pending approvals on Today and notifications came from every case in the office | server/approvals.ts listPendingApprovals | ✅ fixed: row-scoped |
| Any editor could take the partner-approval step (PARTNER → APPROVED) | server/approvals.ts advanceApproval | ✅ fixed: needs CASES at FULL (errors.APPROVAL_NEEDS_PARTNER) |
| Execution collections read the total then incremented it; the new status used the stale total | server/execution.ts recordCollection | ✅ fixed: file row locked for the update |
| Deleting an execution procedure left its follow-up reminder on the calendar | server/execution.ts | ✅ fixed: the linked reminder is removed with it |
| The report-approved event said the report was sent to the client portal before any sending exists | lib/i18n event.hearingReportApproved | ✅ fixed: says approved only; "sent" waits for the portal (M8) |
| Global search passed % and _ through as wildcards | server/search.ts | ✅ fixed: matched literally |
| Two receipts at once could both pass the remaining-amount check (overpaid invoice) | server/invoices.ts recordPayment | ✅ fixed: invoice row locked (e2e with concurrent payments) |
| A double submit could bill the same hours or expense twice | server/fees.ts, expenses.ts | ✅ fixed: source claimed by a conditional update in the invoice transaction |
| Journal descriptions stored Arabic text; ledger rows could be edited by the app | lib/finance/ledger.ts | ✅ fixed: i18n key + params; journal/trust history insert-only by grant |
| Document numbers by scanning all rows + retry on collision | lib/finance/ledger.ts nextNumber | ✅ fixed: per-office counter row, gapless and race-free |
| Fee percentage accepted up to 1000% | server/fees.ts | ✅ fixed: 0–100% |
| Trust pages needed the clients module, which accountants don't have | app/finance/trust | ✅ fixed: finance-scoped client picker |
| Uploads trusted the browser-declared MIME type | app/documents/upload-actions.ts | ✅ fixed: file signature checked against the declared type (errors.UPLOAD_CONTENT_MISMATCH) |
| Deleted documents of out-of-scope cases were listed in the recycle bin | server/settings.ts | ✅ fixed: recycle bin applies the case row scope to documents |

