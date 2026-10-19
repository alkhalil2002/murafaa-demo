# ADR-0003: Platform admin layer (إدارة المنصة)

- **Status:** Accepted (owner, 2026-10-19)
- **Related:** ADR-0001 (RLS always on), ADR-0002 (Design System v2, `ui_kits/platform-admin`)

## Context

- **Offices could only come from the seed.** `pnpm db:seed` was the only way to create one. No role stood above the offices to add an office, suspend it, or record what it has paid.
- **A phone in two offices could not sign in.** Sign-in resolves an office from the phone alone and refuses an ambiguous match.
- **The new layer must not weaken the guarantees.** Isolation is by RLS, there is no "god mode", and under PDPL the platform team must not see case content.

**Owner decisions (2026-10-19):**
- No plans or prices for now.
- Billing is recorded by hand.
- A suspended office is **read-only**.
- A staff phone may belong to **one office only**.

## Decision

1. **Its own identity.**
   - Platform operators live in `platform_admins`. Their sessions (`platform_sessions`, cookie `murafaa_platform`, 15-minute idle and 12-hour lifetime) never resolve to an office or portal principal, and office or portal sessions never reach `/api/v1/platform/*` routes (`@PlatformRoute()`).
   - Sign-in is an OTP **plus a mandatory TOTP**, optionally limited to `PLATFORM_IP_ALLOWLIST`.
   - Operators are created only by `pnpm platform:admin:create`, which prints the TOTP URI once. No web page can create one.
2. **Platform tables have no `office_id`.** They are the documented exception to "office_id on every table".
   - They use `platformPolicy()`, which requires `app.platform = 'on'`. `withPlatform()` sets that flag for one transaction.
   - They are FORCE RLS, with least-privilege grants, and the audit log is append-only.
   - A tenant transaction reads nothing from them.
3. **Cross-office reads only through `platform_api`.** These are SECURITY DEFINER functions owned by the NOLOGIN role `murafaa_platform`. That role has column-limited grants: office metadata, `users` (name, role, active, last login), and only `office_id`, `deleted_at` and `size_bytes` from cases, clients and documents.
   - The functions return metadata and counts only.
   - Every function raises outside `withPlatform()`.
4. **Creating an office is one transaction:**
   1. Refuse the partner's phone if any office already has it (`auth_api.phone_offices`).
   2. Insert the office.
   3. Run `seedOfficePolicy()` (the docs/04 matrix).
   4. Insert the first PARTNER.
   5. Audit in the office's `audit_log` and in `platform_audit_log`.

   The chart of accounts and counters still fill lazily. HR's grant-account also refuses a phone that belongs to another office.
5. **Suspended = read-only.** Staff and portal sessions carry `officeReadOnly`. The guard refuses every non-read route with `errors.OFFICE_SUSPENDED`, except sign-out and the role-preview switch, and the office shell shows a banner. Data is kept, and sign-in still works.
6. **Billing is manual.** Offices carry `status` (TRIAL / ACTIVE / SUSPENDED), `trial_ends_at` and `paid_until`. The screens highlight what is due or overdue.
   - **Nothing is suspended automatically**, because that needs the jobs runner and there is no in-process cron.
   - Online payment shows «غير متصل».

## Consequences

- Design screens left out:
  - plans and prices, MRR and invoices;
  - «إرسال الدعوة» (WhatsApp is not connected; the partner signs in with OTP);
  - AI query counts (not recorded per office yet).
- Open items in `docs/MIGRATION.md`:
  - plans and seat limits;
  - platform invoicing;
  - automatic suspension;
  - AI usage metering.
- Existing duplicate phones (from before this rule) still cannot sign in. New ones can no longer be created.

## Addendum (owner, 2026-10-19): team roles and activation links

- **Roles.** `PLATFORM_ROLES` and `canPlatform()` live in `packages/auth`, with unit tests. No role sees office content.
  - **OWNER:** everything, including `team.manage`.
  - **OPERATIONS:** create offices, change their status, change their dates.
  - **BILLING:** paid-until and trial end only.
  - **SUPPORT:** read only.
- **Enforcement.**
  - `@PlatformRoute(action)` is enforced by the guard.
  - The office PATCH requires `office.status` when the status changes and `subscription.update` when a date changes.
  - Denials are audited as `platform.denied`.
  - The role is read fresh on every request.
- **Members join from «فريق المنصة»** (owner only) through a **one-time activation link**:
  - The link is 24 h, single use, and burned after 5 wrong codes.
  - The token sits in the URL fragment and is stored only as a SHA-256 hash.
  - Activation steps: an OTP to the invited phone, then a new TOTP secret shown **only in the member's own browser**, then its first code.
- **Team rules.**
  - Nobody changes their own role or access.
  - At least one active owner always remains.
  - Disabling a member ends their sessions.
  - «رابط جديد» (lost phone) clears the authenticator and issues a new link.
- **The CLI only creates the first owner** (or resets an owner locked out entirely), and it prints a link, not a QR. Links are built from `WEB_ORIGIN` (default: the first `CORS_ORIGINS` entry).
