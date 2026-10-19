# Legacy → new architecture migration tracker

Every file, screen, route and model in `legacy/` with where it went or which milestone owns it, so no feature is lost in the rebuild (ADR-0001). Update this file in the same PR that ports something.

Milestones follow `docs/02` §13. **M1 Foundation** now also includes: staff OTP login, TOTP 2FA, editable permissions (all three layers), office IP allowlist enforcement, and audit writers.

## Summary (Migration tracker)

| Area | Legacy | ✅ Done | Remaining |
|---|---|---|---|
| `src/lib` files | 51 | 50 | 1 |
| Business rules inside services/components | 37 | 34 | 3 |
| Services | 54 | 53 | 1 |
| Service capabilities | 225 | 221 | 4 |
| Screens | 63 | 63 | 0 |
| Components | 20 | 20 | 0 |
| Route handlers | 9 | 8 (+1 replaced) | 0 |
| Models | 56 | 55 (+ `outbox`, `sessions` new) | 1 |
| Legacy test cases | 115 | 108 | 7 (`portal` 5 rewrite in M8, `hearing-draft` 2 not ported) |

Legend: ✅ Ported (with tests) · ⏳ Pending (milestone) · 🔁 Rebuild (design changes, reason given) · ⛔ Not ported (reason given)

## `src/lib` (51 files)

| File | Status | Where / milestone | Notes |
|---|---|---|---|
| `ai/embed.ts` | ⛔ Not ported | — | 64-dim hash stub (not real vectors); retrieval is Postgres full-text search until an embedding provider is chosen (owner question) |
| `ai/gate.ts` | ✅ Ported | apps/api/src/modules/ai/gate.ts | 17 tests |
| `ai/hearing-draft.ts` | ✅ Ported | apps/api/src/modules/ai/ai.service.ts hearingDraft | same prompt and 3 fields; now through the provider, PII redaction and the gate (legacy called api.anthropic.com and skipped both) |
| `ai/kb-seed.ts` | ✅ Ported | apps/api/scripts/seed-demo.ts DEMO_KB | dev only, per office, stored is_demo and labelled as not official text |
| `ai/llm.ts` | ✅ Ported | apps/api/src/modules/ai/llm.ts | provider interface; StubLlm dropped (fake answers): not connected until AI_PROVIDER is set; Vertex (me-central2) is the first implementation |
| `ai/vector.ts` | ✅ Ported | apps/api/src/modules/ai/ai.service.ts retrieve | in-app cosine over all chunks → indexed Postgres full-text search (top 5, active sources of the office); pgvector once embeddings exist |
| `api/response.ts` | ✅ Ported | packages/contracts/src/envelope.ts + API envelope interceptor/filter |  |
| `audit/index.ts` | ✅ Ported | apps/api/src/common/audit/audit.ts | auth events + permission denials written; other modules add theirs |
| `auth/config.ts` | ✅ Ported | apps/api/src/modules/auth (Auth.js replaced by API sessions) | e2e: apps/api/test/api.e2e.test.ts |
| `auth/emp-portal-otp.ts` | ✅ Ported | apps/api/src/modules/portal/portal-auth.service.ts | one flow for both portals; codes bound to the portal kind; own challenge table |
| `auth/emp-portal-session.ts` | ✅ Ported | apps/api/src/modules/portal/portal-session.service.ts | revocable DB session (legacy: signed cookie, 7 days, no revocation) |
| `auth/index.ts` | ✅ Ported | apps/api/src/modules/auth/auth.service.ts | OTP + TOTP; same OTP reusable until every check passes |
| `auth/otp-provider.ts` | ✅ Ported | apps/api/src/modules/auth/otp-provider.ts | console (dev) + Unifonic placeholder exactly as legacy (not connected); boot refuses console in production |
| `auth/otp.ts` | ✅ Ported | apps/api/src/modules/auth/auth.service.ts | unknown/ambiguous numbers now get the same response (no enumeration) |
| `auth/phone.ts` | ✅ Ported | packages/rules/src/phone.ts | 2 tests |
| `auth/portal-otp.ts` | ✅ Ported | apps/api/src/modules/portal/portal-auth.service.ts | unknown numbers get the same answer; sign-in lookup through auth_api.portal_candidates() |
| `auth/portal-session.ts` | ✅ Ported | apps/api/src/modules/portal/portal-session.service.ts | subject re-checked on every request: deactivation ends access at once |
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
| `performance.ts` | ✅ Ported | apps/api/src/modules/performance/performance.service.ts | written by tasks, hearings, documents, invoices and lead conversion in their transaction; each source counts once (legacy re-awarded a task moved out of DONE and back) |
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
| `ai` | ✅ Ported | apps/api/src/modules/ai (assistant, case analysis, arena, hearing draft, knowledge base; every output through the gate) |  |
| `alerts` | ✅ Ported | apps/api/src/modules/overview (row-scoped; overdue invoices join with M4) |  |
| `appointments` | ✅ Ported | apps/api/src/modules/appointments (+ booking/cancel UI legacy lacked) |  |
| `approvals` | ✅ Ported | apps/api/src/modules/cases/approvals.service.ts (partner step needs CASES at FULL; pending list row-scoped) |  |
| `billing-usage` | ✅ Ported | apps/api/src/modules/billing (GET /billing/usage; live seats, cases, clients, documents) |  |
| `case-profitability` | ✅ Ported | apps/api/src/modules/finance/reports.service.ts profitability |  |
| `cases` | ✅ Ported | apps/api/src/modules/cases (effectiveStage follows held hearings) |  |
| `client-approvals` | ✅ Ported | apps/api/src/modules/cases/casework.service.ts; the client decides in ClientCasesService.decide (row lock, once) |  |
| `clients` | ✅ Ported | apps/api/src/modules/crm (conflict re-scan on rename joins with cases, M2 slice 2) |  |
| `communications` | ✅ Ported | apps/api/src/modules/cases/casework.service.ts (+ messageLog behind GET /whatsapp/messages, row-scoped) |  |
| `contracts` | ✅ Ported | apps/api/src/modules/cases/casework.service.ts |  |
| `dashboard` | ✅ Ported | apps/api/src/modules/overview |  |
| `deadlines` | ✅ Ported | apps/api/src/modules/cases/deadlines.service.ts (GET /deadlines) |  |
| `documents` | ✅ Ported | apps/api/src/modules/documents (uploads checked against file content; template generation; hearing report PDF) |  |
| `emp-portal` | ✅ Ported | apps/api/src/modules/portal + hr EmployeesService.selfProfile, HrRecordsService.selfRequests/selfSubmit |  |
| `execution` | ✅ Ported | apps/api/src/modules/cases/execution.service.ts (row-locked collections; office-checked follow-up assignee) |  |
| `expenses` | ✅ Ported | apps/api/src/modules/finance/expenses.service.ts + fees.service.ts (time entries) |  |
| `fees` | ✅ Ported | apps/api/src/modules/finance/fees.service.ts (hourly time claimed atomically: billed once) |  |
| `finance-bank` | ✅ Ported | apps/api/src/modules/finance/bank.service.ts |  |
| `finance-dashboard` | ✅ Ported | apps/api/src/modules/finance/reports.service.ts dashboard |  |
| `finance-governance` | ✅ Ported | apps/api/src/modules/finance/governance.service.ts (approval queue added; approver must not be the recorder) |  |
| `hearings` | ✅ Ported | apps/api/src/modules/cases/hearings.service.ts + hearings.controller.ts |  |
| `hr/advances` | ✅ Ported | apps/api/src/modules/hr/records.service.ts (journal through finance LedgerPoster) |  |
| `hr/attendance` | ✅ Ported | apps/api/src/modules/hr/records.service.ts |  |
| `hr/employees` | ✅ Ported | apps/api/src/modules/hr/employees.service.ts (grant account: only a partner may grant PARTNER; terminate disables the login) |  |
| `hr/index` | ✅ Ported | apps/api/src/modules/hr/hr.module.ts |  |
| `hr/integrations` | ✅ Ported | apps/api/src/modules/integrations (one adapter interface; every platform NotConnected until a signed API contract exists: no connect/sync simulation) |  |
| `hr/leaves` | ✅ Ported | apps/api/src/modules/hr/records.service.ts |  |
| `hr/org-chart` | ✅ Ported | apps/api/src/modules/hr/employees.service.ts orgChart |  |
| `hr/payroll` | ✅ Ported | apps/api/src/modules/hr/payroll.service.ts |  |
| `hr/recruitment` | ✅ Ported | apps/api/src/modules/hr/recruitment.service.ts |  |
| `hr/requests` | ✅ Ported | apps/api/src/modules/hr/records.service.ts |  |
| `hr/saudization` | ✅ Ported | apps/api/src/modules/hr/employees.service.ts saudization |  |
| `hr/wps` | ✅ Ported | apps/api/src/modules/hr/payroll.service.ts wps (IBANs masked, view audited) |  |
| `invoices` | ✅ Ported | apps/api/src/modules/finance/invoices.service.ts (invoice row locked for payments/credit notes/write-offs); ZATCA phase-1 tax invoice PDF + QR in invoice-pdf.service.ts |  |
| `journey` | ✅ Ported | apps/api/src/modules/overview (invoice and WhatsApp counts join with M4/M7) |  |
| `leads` | ✅ Ported | apps/api/src/modules/crm (incl. convertLead) |  |
| `ledger-reports` | ✅ Ported | apps/api/src/modules/finance/reports.service.ts (trial balance, VAT return, aging, statements, manual entry) |  |
| `messages` | ✅ Ported | apps/api/src/modules/cases/casework.service.ts (client side with the portal, M8) |  |
| `notifications` | ✅ Ported | apps/api/src/modules/overview (+ GET /notifications/count for the bell; invoices join with M4) |  |
| `office-settings` | ✅ Ported | apps/api/src/modules/offices (GET/PUT /offices/branding) |  |
| `permissions-admin` | ✅ Ported | apps/api/src/modules/permissions |  |
| `portal` | ✅ Ported | apps/api/src/modules/portal (controllers) + cases ClientCasesService, documents client*, finance clientInvoices: each module answers only for the signed-in client |  |
| `procedure-requests` | ✅ Ported | apps/api/src/modules/cases/procedure-requests.service.ts |  |
| `pulse` | ✅ Ported | apps/api/src/modules/pulse (Riyadh-time windows) |  |
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
| `/ai` | ✅ Ported | apps/web/src/app/(app)/ai (+ not-connected banner) |  |
| `/ai/arena/[caseId]` | ✅ Ported | apps/web/src/app/(app)/ai/arena/[caseId] |  |
| `/ai/kb` | ✅ Ported | apps/web/src/app/(app)/ai/kb (+ add source and activate/deactivate at the full AI level) |  |
| `/alerts` | ✅ Ported | apps/web/src/app/(app)/alerts |  |
| `/appointments` | ✅ Ported | apps/web/src/app/(app)/appointments |  |
| `/billing` | ✅ Ported | apps/web/src/app/(app)/billing |  |
| `/cases` | ✅ Ported | apps/web/src/app/(app)/cases (list + filters) |  |
| `/cases/[id]` | ✅ Ported | apps/web/src/app/(app)/cases/[id] — every tab: overview (+ procedural requests), hearings, parties (+ contact log), assistant, chat, documents, contracts, finance, approvals (+ client approvals), execution, events, closing |  |
| `/cases/new` | ✅ Ported | apps/web/src/app/(app)/cases/new |  |
| `/clients` | ✅ Ported | apps/web/src/app/(app)/clients (+ CRM KPIs) |  |
| `/dashboard` | ✅ Ported | apps/web/src/app/(app)/dashboard |  |
| `/deadlines` | ✅ Ported | apps/web/src/app/(app)/deadlines |  |
| `/documents` | ✅ Ported | apps/web/src/app/(app)/documents (template list) |  |
| `/documents/new/[key]` | ✅ Ported | apps/web/src/app/(app)/documents/new/[key] (prefilled from the case, fee fields hidden for denied roles) |  |
| `/emp-portal/(app)` | ✅ Ported | apps/web/src/app/emp-portal/(app) |  |
| `/emp-portal/login` | ✅ Ported | apps/web/src/app/emp-portal/login |  |
| `/finance` | ✅ Ported | apps/web/src/app/(app)/finance (invoices + new-invoice form from the prototype) |  |
| `/finance/[id]` | ✅ Ported | apps/web/src/app/(app)/finance/[id] |  |
| `/finance/bank` | ✅ Ported | apps/web/src/app/(app)/finance/bank |  |
| `/finance/coa` | ✅ Ported | apps/web/src/app/(app)/finance/coa |  |
| `/finance/dashboard` | ✅ Ported | apps/web/src/app/(app)/finance/dashboard |  |
| `/finance/expenses` | ✅ Ported | apps/web/src/app/(app)/finance/expenses (+ add-expense form from the prototype) |  |
| `/finance/governance` | ✅ Ported | apps/web/src/app/(app)/finance/governance (+ approval queue) |  |
| `/finance/journal` | ✅ Ported | apps/web/src/app/(app)/finance/journal (+ manual entry, full level) |  |
| `/finance/ledger` | ✅ Ported | apps/web/src/app/(app)/finance/ledger |  |
| `/finance/profitability` | ✅ Ported | apps/web/src/app/(app)/finance/profitability (+ office time log) |  |
| `/finance/statements` | ✅ Ported | apps/web/src/app/(app)/finance/statements (+ client statement) |  |
| `/finance/trust` | ✅ Ported | apps/web/src/app/(app)/finance/trust |  |
| `/finance/trust/[clientId]` | ✅ Ported | apps/web/src/app/(app)/finance/trust/[clientId] |  |
| `/hr` | ✅ Ported | apps/web/src/app/(app)/hr |  |
| `/hr/[id]` | ✅ Ported | apps/web/src/app/(app)/hr/[id] |  |
| `/hr/advances` | ✅ Ported | apps/web/src/app/(app)/hr/advances |  |
| `/hr/attendance` | ✅ Ported | apps/web/src/app/(app)/hr/attendance |  |
| `/hr/integrations` | ✅ Ported | apps/web/src/app/(app)/hr/integrations (status from the API; no connect buttons: owner decision) + settings integrations panel |  |
| `/hr/leaves` | ✅ Ported | apps/web/src/app/(app)/hr/leaves |  |
| `/hr/org` | ✅ Ported | apps/web/src/app/(app)/hr/org |  |
| `/hr/payroll` | ✅ Ported | apps/web/src/app/(app)/hr/payroll (defaults to the current month; legacy hard-coded July 2026) |  |
| `/hr/payroll/[id]` | ✅ Ported | apps/web/src/app/(app)/hr/payroll/[id] (+ WPS records) |  |
| `/hr/performance` | ✅ Ported | apps/web/src/app/(app)/hr/performance |  |
| `/hr/recruitment` | ✅ Ported | apps/web/src/app/(app)/hr/recruitment |  |
| `/hr/requests` | ✅ Ported | apps/web/src/app/(app)/hr/requests |  |
| `/hr/saudization` | ✅ Ported | apps/web/src/app/(app)/hr/saudization |  |
| `/journey` | ✅ Ported | apps/web/src/app/(app)/journey |  |
| `/leads` | ✅ Ported | apps/web/src/app/(app)/leads (pipeline incl. convert) |  |
| `/login` | ✅ Ported | apps/web/src/app/login (+ components/auth/login-form.tsx) |  |
| `/notifications` | ✅ Ported | apps/web/src/app/(app)/notifications (+ bell count) |  |
| `/perms` | ✅ Ported | apps/web/src/app/(app)/perms (matrix + role preview) |  |
| `/perms/audit` | ✅ Ported | apps/web/src/app/(app)/perms/audit |  |
| `/perms/security` | ✅ Ported | apps/web/src/app/(app)/perms/security |  |
| `/perms/users` | ✅ Ported | apps/web/src/app/(app)/perms/users |  |
| `/portal/(app)` | ✅ Ported | apps/web/src/app/portal/(app) |  |
| `/portal/(app)/cases/[id]` | ✅ Ported | apps/web/src/app/portal/(app)/cases/[id] |  |
| `/portal/(app)/invoices` | ✅ Ported | apps/web/src/app/portal/(app)/invoices |  |
| `/portal/login` | ✅ Ported | apps/web/src/app/portal/login (+ proxy: own cookie and login page per portal) |  |
| `/pulse` | ✅ Ported | apps/web/src/app/(app)/pulse |  |
| `/search` | ✅ Ported | apps/web/src/app/(app)/search (+ topbar dropdown) |  |
| `/settings` | ✅ Ported | apps/web/src/app/(app)/settings (branding, recycle bin, account) |  |
| `/tasks` | ✅ Ported | apps/web/src/app/(app)/tasks (kanban) |  |
| `/today` | ✅ Ported | apps/web/src/app/(app)/today |  |
| `/whatsapp` | ✅ Ported | apps/web/src/app/(app)/whatsapp (hand-recorded message log; no WhatsApp integration) |  |

## Route handlers (9)

| Route | Status | Milestone | Notes |
|---|---|---|---|
| `api/auth/2fa-status` | ⛔ Not ported | — | replaced by the TOTP_REQUIRED answer after a correct OTP, so 2FA status is not exposed before the code |
| `api/auth/[...nextauth]` | ✅ Ported | POST /api/v1/auth/verify, GET /auth/me, POST /auth/logout |  |
| `api/auth/otp` | ✅ Ported | POST /api/v1/auth/otp |  |
| `api/documents/[id]/download` | ✅ Ported | GET /api/v1/documents/:id/download (streamed through the API, audited; no bucket URL) |  |
| `api/emp-portal-auth/otp` | ✅ Ported | POST /api/v1/emp-portal/auth/otp |  |
| `api/emp-portal-auth/verify` | ✅ Ported | POST /api/v1/emp-portal/auth/verify |  |
| `api/portal-auth/otp` | ✅ Ported | POST /api/v1/portal/auth/otp |  |
| `api/portal-auth/verify` | ✅ Ported | POST /api/v1/portal/auth/verify |  |
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
| `Expense` | ✅ Ported | packages/database expenses |  |
| `TimeEntry` | ✅ Ported | packages/database time_entries |  |
| `TrustAccount` | ✅ Ported | packages/database trust_accounts (CHECK balance >= 0) |  |
| `TrustTransaction` | ✅ Ported | packages/database trust_transactions (insert-only) |  |
| `ChartOfAccount` | ✅ Ported | packages/database chart_of_accounts (seeded on first posting) |  |
| `JournalEntry` | ✅ Ported | packages/database journal_entries (insert-only, + doc_counters) |  |
| `JournalLine` | ✅ Ported | packages/database journal_lines (insert-only, + office_id, CHECK one side) |  |
| `AccountingPeriod` | ✅ Ported | packages/database accounting_periods |  |
| `KnowledgeSource` | ✅ Ported | packages/database knowledge_sources (+ office_id, is_active, is_demo; legacy was global) |  |
| `KnowledgeChunk` | ✅ Ported | packages/database knowledge_chunks (+ office_id, generated tsvector + GIN index instead of a JSON embedding) |  |
| `AiInteraction` | ✅ Ported | packages/database ai_interactions (insert-only; stores the redacted question) |  |
| `AiCitation` | ✅ Ported | packages/database ai_citations (insert-only) |  |
| `Employee` | ✅ Ported | packages/database employees (CHECKs: money and leave balance >= 0, score 0–100) |  |
| `Advance` | ✅ Ported | packages/database advances (CHECK 0 <= paid <= amount) |  |
| `Leave` | ✅ Ported | packages/database leaves |  |
| `IntegrationConnection` | ⛔ Not ported | — | it stored a simulated connected flag; status now comes from the platform adapter (apps/api/src/modules/integrations); a per-office credentials table arrives with the first real contract |
| `Candidate` | ✅ Ported | packages/database candidates |  |
| `Attendance` | ✅ Ported | packages/database attendance (unique office + employee + day) |  |
| `EmployeeRequest` | ✅ Ported | packages/database employee_requests (decisions lock the row) |  |
| `PayrollRun` | ✅ Ported | packages/database payroll_runs (unique office + period) |  |
| `PayrollLine` | ✅ Ported | packages/database payroll_lines (insert-only, + office_id, CHECK net = gross − deductions) |  |
| `PerformanceEvent` | ✅ Ported | packages/database performance_events (insert-only, + source_id unique per kind) |  |
| `OfficePerformanceWeight` | ✅ Ported | packages/database office_performance_weights (reset = soft delete) |  |
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
| `portal.test.ts` | ✅ Ported | apps/api/test/api.e2e.test.ts (portals describe) | rewritten as API e2e |

## Components (20)

Pending in `apps/web/src/components` with shadcn/ui; the app shell and nav come first with M1 login. `idle-logout.tsx` and `cases/ai-draft-hearing-button.tsx` hard-coded Arabic; rebuild them through i18n.

| Component | Status | Milestone | Notes |
|---|---|---|---|
| `ai-answer.tsx` | ✅ Ported | apps/web/src/components/ai/ai-answer.tsx |  |
| `app-shell.tsx` | ✅ Ported | apps/web/src/components/shell/app-shell.tsx + nav.ts (bell count from /notifications/count) |  |
| `auth/login-form.tsx` | ✅ Ported | apps/web/src/components/auth/login-form.tsx |  |
| `auto-submit-select.tsx` | ✅ Ported | apps/web/src/components/auto-submit-select.tsx |  |
| `cases/ai-draft-hearing-button.tsx` | ✅ Ported | apps/web/src/components/ai/ai-controls.tsx HearingDraftButton (i18n) |  |
| `cases/case-list.tsx` | ✅ Ported | apps/web/src/components/cases/case-list.tsx |  |
| `cases/hearing-wizard.tsx` | ✅ Ported | apps/web/src/components/cases/hearings.tsx RecordHearingWizard |  |
| `cases/najiz-picker.tsx` | ✅ Ported | apps/web/src/components/cases/case-form.tsx |  |
| `cases/role-picker.tsx` | ✅ Ported | apps/web/src/components/cases/case-form.tsx |  |
| `conflict-badge.tsx` | ✅ Ported | apps/web/src/components/cases/conflict-badge.tsx |  |
| `emp-portal/emp-portal-login-form.tsx` | ✅ Ported | apps/web/src/components/portal/portal-login-form.tsx |  |
| `finance-tabs.tsx` | ✅ Ported | apps/web/src/components/finance/finance-tabs.tsx |  |
| `hr-tabs.tsx` | ✅ Ported | apps/web/src/components/hr/hr-tabs.tsx |  |
| `hr-ui.tsx` | ✅ Ported | apps/web/src/components/hr/hr-ui.tsx (errors come from the API messageKey instead of ?err=) |  |
| `icons.tsx` | ✅ Ported | apps/web/src/components/icons.tsx |  |
| `idle-logout.tsx` | ✅ Ported | apps/web/src/components/shell/idle-logout.tsx |  |
| `perms-tabs.tsx` | ✅ Ported | apps/web/src/components/perms/perms-tabs.tsx |  |
| `portal/portal-login-form.tsx` | ✅ Ported | apps/web/src/components/portal/portal-login-form.tsx (one form for both portals) |  |
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
| `src/app/globals.css (component classes)` | ✅ Ported | apps/web/src/app/globals.css | Design System v2 component classes (mf- prefix dropped, same names); tokens in src/styles/tokens, fonts self-hosted (owner decision 2026-10-19) |
| `prisma/seed.ts` | ✅ Ported | packages/database/src/seed.ts (`pnpm db:seed`, runs as the app role) |  |
| `src/app/layout.tsx (root: fonts, RTL, metadata)` | ✅ Ported | apps/web/src/app/layout.tsx |  |
| `src/app/portal/(app)/layout.tsx (client-portal shell)` | ✅ Ported | apps/web/src/app/portal/(app)/layout.tsx |  |
| `src/app/emp-portal/(app)/layout.tsx (employee-portal shell)` | ✅ Ported | apps/web/src/app/emp-portal/(app)/layout.tsx |  |
| `prisma/migrations (35)` | ⛔ Not ported | — | history only; the Drizzle schema is rebuilt table by table |

## Capability checklist (225 exported service functions)

Every capability the legacy services expose. Tick each one when its API endpoint (and test) exists. A rebuilt module is not done until all of its boxes are ticked.

**activity** (M2 Core ops)

- [x] `listActivity`
- [x] `listActivityActors`
- [x] `countActivityByCategory`

**ai** (M5 AI gate)

- [x] `askAssistant`
- [x] `runArenaTurn`
- [x] `getArenaState`
- [x] `runArenaRound`
- [x] `resetArena`
- [x] `listInteractions`
- [x] `listKnowledgeSources`

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

- [x] `getCaseProfitability`

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
- [x] `listMessageCommunications`

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

- [x] `getEmpPortalProfile`
- [x] `listMyRequests`
- [x] `submitEmpRequest`

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

- [x] `createExpense`
- [x] `listExpenses`
- [x] `reimburseExpense`
- [x] `createTimeEntry`
- [x] `listTimeEntries`
- [x] `invoiceTimeEntry`

**fees** (M4 Finance)

- [x] `getFeeAgreement`
- [x] `saveFeeAgreement`
- [x] `generateInvoiceFromFee`

**finance-bank** (M4 Finance)

- [x] `getBankSummary`
- [x] `getBankLedger`
- [x] `toggleBankLineCleared`

**finance-dashboard** (M4 Finance)

- [x] `getFinanceDashboard`

**finance-governance** (M4 Finance)

- [x] `listRecentPeriods`
- [x] `setPeriodLock`
- [x] `getRequireApproval`
- [x] `setRequireApproval`
- [x] `listFinanceAudit`

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

- [x] `createAdvance`
- [x] `listAdvances`

**hr/attendance** (M6 HR)

- [x] `getTodayAttendance`
- [x] `setTodayStatus`
- [x] `clockOut`
- [x] `getMonthlySummary`

**hr/employees** (M6 HR)

- [x] `createEmployee`
- [x] `listEmployees`
- [x] `getEmployee`
- [x] `grantEmployeeAccount`
- [x] `updateEmployee`
- [x] `previewEndOfService`
- [x] `terminateEmployee`

**hr/integrations** (M7 Integrations)

- [x] `listIntegrations`
- [ ] `connectIntegration`
- [ ] `disconnectIntegration`
- [ ] `syncIntegrationNow`

**hr/leaves** (M6 HR)

- [x] `createLeave`
- [x] `listLeaves`

**hr/org-chart** (M6 HR)

- [x] `getOrgChart`

**hr/payroll** (M6 HR)

- [x] `runPayroll`
- [x] `listPayrollRuns`
- [x] `getPayrollRun`

**hr/recruitment** (M6 HR)

- [x] `listCandidates`
- [x] `createCandidate`
- [x] `moveCandidate`
- [x] `deleteCandidate`

**hr/requests** (M6 HR)

- [x] `createRequest`
- [x] `decideRequest`
- [x] `listRequests`

**hr/saudization** (M6 HR)

- [x] `getSaudizationStatus`

**hr/wps** (M6 HR)

- [x] `generateWpsFile`

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

- [x] `trialBalance`
- [x] `agingReport`
- [x] `vatReturn`
- [x] `listJournal`
- [x] `getFinancialStatements`
- [x] `getCashFlowStatement`
- [x] `listAccounts`
- [x] `createManualJournalEntry`

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

- [x] `listPortalCases`
- [x] `getPortalCase`
- [x] `listPortalDocuments`
- [x] `getPortalDocumentForDownload`
- [x] `listPortalMessages`
- [x] `sendPortalMessage`
- [x] `listPortalApprovals`
- [x] `decidePortalApproval`
- [x] `uploadPortalDocument`
- [x] `listPortalInvoices`

**procedure-requests** (M2 Core ops)

- [x] `addProcedureRequest`
- [x] `cycleProcedureRequestStatus`
- [x] `deleteProcedureRequest`
- [x] `listProcedureRequests`

**pulse** (M6 HR)

- [x] `getPulseRanking`
- [x] `getEmployeeOfWeek`
- [x] `getPulseTeamTotals`
- [x] `getPulseSelfCard`
- [x] `getPulseDrilldown`
- [x] `getPerformanceWeights`
- [x] `setPerformanceWeight`
- [x] `resetPerformanceWeight`
- [x] `canViewPulseTeam`

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
| `Fee basis labels + unbilled-time collection` | server/fees.ts | i18n invoice.basis.* + apps/api fees.service (unbilled time claimed atomically) | ✅ Ported (e2e) |
| `Journal posting rules for invoice, payment, credit note, bad debt, expense, advance, payroll, trust (deposit/withdraw/transfer)` | invoices.ts, trust.ts, expenses.ts, hr/advances.ts, hr/payroll.ts | packages/rules postings.ts (every builder tested balanced) | ✅ Ported |
| `Standard account codes (ACC) + default chart of accounts (14 accounts)` | lib/finance/ledger.ts, prisma/seed.ts | packages/rules postings.ts ACC, COA_SEED | ✅ Ported |
| `Trust balance can never go negative` | trust.ts conditional decrement | packages/rules canDebitTrust + DB check in M4 | ✅ Ported (rule) |
| `Per-office document numbering (INV-1043…, REC, CN, JV bases)` | lib/finance/ledger.ts nextNumber | packages/rules nextDocNumber (+ unique index + retry in M4) | ✅ Ported (rule) |
| `OTP policy: 6 digits, 5-min TTL, 5 attempts, 30-s resend cooldown, HMAC-stored` | lib/auth/otp.ts, portal-otp.ts, emp-portal-otp.ts | packages/auth otp-policy.ts | ✅ Ported (rules); hashing/sending in M1 |
| `Role preview is view-only: every write blocked, except starting/ending the preview` | lib/permissions/guard.ts requireModule/canAction | packages/auth previewAllows + API PermissionsGuard | ✅ Ported |
| `Objection reminder task due 5 days before the deadline (AUDIT Q11)` | server/hearings.ts | packages/rules objectionReminderDue | ✅ Ported |
| `Credit note blocked when credited, bad debt, or any payment exists` | server/invoices.ts issueCreditNote | packages/rules creditNoteBlocker | ✅ Ported |
| `Advance: installment ≤ amount and never rounds to 0` | server/hr/advances.ts | packages/rules advanceBlocker | ✅ Ported |
| `Approving a leave request needs days + balance, then deducts it` | server/hr/requests.ts decideRequest | packages/rules leaveApprovalBlocker + apps/api hr decideRequest | ✅ Ported (e2e) |
| `Saudization counts every non-terminated employee` | server/hr/saudization.ts | packages/rules countsForSaudization | ✅ Ported |
| `A decided (approved/rejected) HR request is terminal` | server/hr/requests.ts | packages/rules requestDecided + apps/api hr records (row lock) | ✅ Ported (e2e) |
| `Conflict flags: a documented waiver survives re-scans; creating a client/lead re-scans existing cases` | lib/conflict/service.ts | apps/api cases/conflicts.service.ts | ✅ Ported (e2e) |
| `Hearing reminders can recur (reminderRecurDays) and escalate to a task` | server/hearings.ts | apps/api hearings: escalate, and a pending hearing keeps one recurring reminder (prototype; legacy only stored the interval). Rolling the due date forward needs the Cloud Scheduler jobs runner | 🟡 Partial |
| `Integrations start disconnected and are never shown as connected without a real connection` | server/hr/integrations.ts | apps/web /hr/integrations: all six shown not connected, no simulated connect (M7 wires real ones) | ✅ Ported (owner decision) |
| `Screen → module map + free screens (docs/04 VIEW2MOD/FREE_VIEWS); legacy app-shell nav` | components/app-shell.tsx | packages/auth screens.ts (docs/04 wins on 4 deviations, see AUDIT table) | ✅ Ported |
| `Global search: ≥2 chars, 8 per category, category gated by module, cases/documents/tasks row-scoped` | server/search.ts, shell-frame.tsx | packages/auth SEARCH_CATEGORY_MODULE + apps/api overview search | ✅ Ported (e2e; % and _ taken literally) |
| `Idle sign-out after 20 minutes (mouse/key/click/scroll/touch)` | components/idle-logout.tsx | packages/auth SESSION_POLICY | ✅ Ported (rule); component in M1 |
| `Service error codes with localized messages (PAYROLL_ALREADY_RUN, PERIOD_LOCKED, …)` | components/hr-ui.tsx ERR_KEYS | API error messageKey (hr.err.*, errors.*) shown by each form | ✅ Ported |
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
| `ai/actions.ts` | ✅ Ported | apps/api /ai/* endpoints |  |
| `cases/actions.ts` | ✅ Ported | apps/api /cases endpoints |  |
| `cases/approvals-actions.ts` | ✅ Ported | apps/api /cases/:id/approvals endpoints |  |
| `cases/client-approvals-actions.ts` | ✅ Ported | apps/api /cases/:id/client-approvals endpoints |  |
| `cases/closing-actions.ts` | ✅ Ported | apps/api /cases/:id outcome, closing checklist, satisfaction, referral, archive |  |
| `cases/communication-actions.ts` | ✅ Ported | apps/api /cases/:id/communications endpoints |  |
| `cases/contract-actions.ts` | ✅ Ported | apps/api /cases/:id/contracts endpoints |  |
| `cases/edit-actions.ts` | ✅ Ported | apps/api PATCH /cases/:id |  |
| `cases/execution-actions.ts` | ✅ Ported | apps/api /cases/:id/execution endpoints |  |
| `cases/hearing-actions.ts` | ✅ Ported | apps/api /cases/:id/hearings endpoints |  |
| `cases/hearing-ai-actions.ts` | ✅ Ported | apps/api POST /cases/:id/hearings/draft |  |
| `cases/message-actions.ts` | ✅ Ported | apps/api /cases/:id/messages endpoints |  |
| `cases/proc-actions.ts` | ✅ Ported | apps/api /cases/:id/stage/promote|remand, /procedure/end|reopen |  |
| `cases/procedure-request-actions.ts` | ✅ Ported | apps/api /cases/:id/procedure-requests endpoints |  |
| `clients/actions.ts` | ✅ Ported | apps/api /clients endpoints |  |
| `documents/actions.ts` | ✅ Ported | apps/api /documents/generate, /documents/:id/share, DELETE /documents/:id, /cases/:id/documents/clear-opening |  |
| `documents/upload-actions.ts` | ✅ Ported | apps/api POST /cases/:id/documents (raw bytes + query metadata) |  |
| `emp-portal/actions.ts` | ✅ Ported | apps/api /emp-portal/* endpoints |  |
| `finance/actions.ts` | ✅ Ported | apps/api /finance/* endpoints |  |
| `finance/trust/actions.ts` | ✅ Ported | apps/api POST /finance/trust/:clientId/movements |  |
| `hr/actions.ts` | ✅ Ported | apps/api /hr/* endpoints |  |
| `hr/recruitment/actions.ts` | ✅ Ported | apps/api /hr/candidates endpoints |  |
| `leads/actions.ts` | ✅ Ported | apps/api /leads endpoints |  |
| `perms/actions.ts` | ✅ Ported | apps/api /permissions endpoints |  |
| `portal/actions.ts` | ✅ Ported | apps/api /portal/* endpoints |  |
| `pulse/actions.ts` | ✅ Ported | apps/api /pulse/weights endpoints |  |
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
| Knowledge base sample sources | ✅ Ported | apps/api/scripts/seed-demo.ts (dev only, marked demo) |
| Demo staff (6 employees, mixed nationalities) + one advance | ✅ Ported | apps/api/scripts/seed-demo.ts (through the API) |
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
| 2026-10-19 | Murafaa Design System v2 replaces the prototype as the binding visual reference (tokens, type scale, gold limited to 3 uses, shared portal frame); docs stay binding for behaviour | ADR 0002, CLAUDE.md (new rebuild decision) |

## AUDIT.md open questions (first-session audit)

Status as implemented in legacy. Anything marked Open still needs the owner's answer.

| # | Question | Legacy behaviour | Status |
|---|---|---|---|
| 1 | Multi-tenancy | `office_id` everywhere | Decided (2026-07-05); now enforced by RLS |
| 2 | Claude on Vertex in me-central2 | stub LLM; dev fallback called api.anthropic.com | **Open** — M5 built provider-agnostic (AI shows not connected until a provider is set); choose the provider and confirm the model is served in-Kingdom, or approve another region in writing (PDPL) |
| new | Embeddings for retrieval | 64-dim hash stub (not real vectors) | **Open** — full-text search now; pgvector needs an embedding provider (same residency rule) |
| new | ZATCA phase 2 (signed UBL XML, cryptographic stamp, reporting/clearance) | none | **Decided 2026-10-18** — after phase 1, once the office's ZATCA wave and CSID are confirmed; phase 1 (tax invoice PDF + QR) done in M7 |
| new | Credit notes as ZATCA tax documents (QR, reference to the original invoice) | none | **Open** — phase 1 covers invoices; credit-note PDF next |
| new | Najiz / Nafath / Mudad / GOSI / Qiwa / Absher / Muqeem API contracts | simulated toggles | **Decided 2026-10-18** — adapter interface, shown not connected until a signed contract and credentials exist |
| new | WPS bank / Mudad file format | on-screen records only | **Open** — the export file is built with the Mudad integration (M7); which bank format first? |
| new | Knowledge base per office or shared | one global KB | **Open** — built per office under RLS (each office curates its own); a shared official corpus would need a reviewed global table |
| 3 | users vs employees | employees link to an optional user (grantEmployeeAccount) | Implemented; confirm |
| new | Design v2: client portal online payment («دفع الآن») | none | **Open** — no payment gateway; the button is left out until one is contracted (no fabricated integrations) |
| new | Design v2: employee performance criteria, quarterly reviews and manager notes | a single performance score | **Open** — needs the review rules; the employee portal shows only the score until then |
| new | Design v2: employee documents (payslip PDF, contract, GOSI certificate) | none | **Open** — payslip PDF can come from payroll lines; GOSI certificate needs the GOSI integration |
| new | Design v2: sick-leave balance (labour law art. 117) | annual balance only | **Open** — needs the rule in docs/06 before it is shown |
| new | Design v2: platform admin portal (offices, subscriptions, usage, audit) | none (offices only from the seed) | **Decided 2026-10-19** — its own milestone later; needs a cross-office role outside RLS |
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
| AI drafting called api.anthropic.com directly and skipped the citation gate | lib/ai/hearing-draft.ts | ✅ fixed: through the provider (regional) + PII redaction + the gate on every field |
| Stub LLM produced canned legal-sounding answers | lib/ai/llm.ts StubLlm | ✅ fixed: no fake output; AI shows not connected until a provider is configured |
| Portal sessions were signed cookies valid 7 days with no revocation; a deactivated client kept access | lib/auth/portal-session.ts, emp-portal-session.ts | ✅ fixed: portal_sessions rows, revoked on sign-out, subject re-checked on every request |
| Portal OTP verify looked up the latest code by phone across every office and both portals | lib/auth/portal-otp.ts verify | ✅ fixed: per-office, per-portal challenges; codes bound to the portal kind |
| Portal OTP send revealed unregistered numbers (CLIENT_NOT_FOUND) | lib/auth/portal-otp.ts | ✅ fixed: same answer for every number |
| Portal upload trusted the declared file type | server/portal.ts uploadPortalDocument | ✅ fixed: content checked against the type, like staff uploads |
| HR integrations page simulated connect/sync for GOSI, Qiwa, Mudad, ZATCA, Absher, Muqeem | server/hr/integrations.ts | ✅ fixed: all shown not connected, no toggles, until M7 wires a real connection (owner decision) |
| Terminating an employee left their system login active | server/hr/employees.ts terminateEmployee | ✅ fixed: the linked account is disabled in the same transaction (sessions end on the next request) |
| Any role with full HR could grant the PARTNER role | server/hr/employees.ts grantEmployeeAccount | ✅ fixed: only a partner may grant PARTNER |
| Pulse points re-awarded when a task left DONE and came back | server/tasks.ts + lib/performance.ts | ✅ fixed: one event per source (unique office + kind + source_id) |
| Pulse today/month windows used server-local time | server/pulse.ts sinceFor | ✅ fixed: Riyadh midnight (packages/rules pulseSince) |
| Payroll form defaulted to July 2026 | app/hr/payroll/page.tsx | ✅ fixed: current Riyadh month |
| Payroll lines had no office_id; WPS view showed full IBANs and was not audited | PayrollLine, server/hr/wps.ts | ✅ fixed: office_id + RLS; IBANs masked; payroll.wpsView audited |
| Advances, leaves and requests could be recorded for terminated employees | server/hr/*.ts | ✅ fixed: 409 hr.err.EMPLOYEE_ALREADY_TERMINATED |
| Prompts carried client and opponent names and raw phone/ID numbers | server/ai.ts case context | ✅ fixed: party names left out, identifiers redacted (packages/rules redactPii) before the prompt and in storage |
| Answer sources listed citations from sentences the gate removed | components/ai-answer.tsx (all KEPT rows) | ✅ fixed: only citations whose sentence survived, once each |
| Knowledge base was global with no office_id | KnowledgeSource | ✅ fixed: per office under RLS |
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
| Cash flow counted a receipt paid from trust twice (as collected and as trust-to-fees), and unposted expenses as paid | server/ledger-reports.ts getCashFlowStatement | ✅ fixed: operating cash matches the 1000 ledger balance (e2e) |
| Finance dashboard counted cancelled/written-off invoices as outstanding and revenue with VAT, by server-local month | server/finance-dashboard.ts | ✅ fixed: open invoices only, net revenue, Riyadh months |
| Case profitability counted recoverable input VAT and unapproved expenses as cost | server/case-profitability.ts | ✅ fixed: posted expenses at net |
| The require-approval switch marked payments/expenses unapproved but nothing could approve them | server/finance-governance.ts | ✅ fixed: approval queue (prototype approvePayment/approveExpense); approving an expense posts it once; the recorder cannot approve their own entry |
| Unapproved (unposted) expenses counted as money out in the bank view | server/finance-bank.ts | ✅ fixed: only posted expenses |
| Two receipts at once could both pass the remaining-amount check (overpaid invoice) | server/invoices.ts recordPayment | ✅ fixed: invoice row locked (e2e with concurrent payments) |
| A double submit could bill the same hours or expense twice | server/fees.ts, expenses.ts | ✅ fixed: source claimed by a conditional update in the invoice transaction |
| Journal descriptions stored Arabic text; ledger rows could be edited by the app | lib/finance/ledger.ts | ✅ fixed: i18n key + params; journal/trust history insert-only by grant |
| Document numbers by scanning all rows + retry on collision | lib/finance/ledger.ts nextNumber | ✅ fixed: per-office counter row, gapless and race-free |
| Fee percentage accepted up to 1000% | server/fees.ts | ✅ fixed: 0–100% |
| Trust pages needed the clients module, which accountants don't have | app/finance/trust | ✅ fixed: finance-scoped client picker |
| Uploads trusted the browser-declared MIME type | app/documents/upload-actions.ts | ✅ fixed: file signature checked against the declared type (errors.UPLOAD_CONTENT_MISMATCH) |
| Deleted documents of out-of-scope cases were listed in the recycle bin | server/settings.ts | ✅ fixed: recycle bin applies the case row scope to documents |

