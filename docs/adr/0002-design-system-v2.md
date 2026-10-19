# ADR-0002: Murafaa Design System v2 is the visual reference

- **Status:** Accepted (owner, 2026-10-19)
- **Supersedes:** the owner decision of 2026-07-24 that the prototype (`prototype/murafaa-prototype.html`) is the binding 1:1 visual reference. The docs remain binding for behaviour and business rules.

## Context

- The prototype used fractional sizes (12.5, 15.625 … px), gold for buttons, warnings and backgrounds, and parchment as the app page. That made status colours hard to read and the brand colour lose meaning.
- The client and employee portals had no shared frame, and no mobile navigation.
- The owner commissioned the **Murafaa Design System v2**, built from this repo. It defines:
  - tokens: tonal ramps, an integer type scale, 44px controls, one radius per kind;
  - brand rules: gold only for the logo ring, the selected nav item and hover borders; maroon only for urgent (≤2 days), rejected and destructive; parchment only for login and print;
  - a shared portal frame with a bottom bar at 980px and below.
- The owner's condition: nothing in the core business may be dropped to fit the design.

## Decision

1. **Tokens.** `apps/web/src/styles/tokens/*.css` are copied unchanged from the design system. Tailwind reads them through `@theme inline`.
2. **Component classes.** `apps/web/src/app/globals.css` is the design system's `css/components.css` with the `mf-` prefix dropped. The class names were already the same, so screens changed look without changing markup.
3. **Fonts.** IBM Plex Sans Arabic and Amiri are self-hosted (`apps/web/public/fonts`). Nothing is fetched from Google at build or run time.
4. **Warnings use amber.** Gold used for warnings and pending states moves to the amber ramp.
5. **Shared portal frame.** `components/portal/portal-shell.tsx` serves both portals.
   - The client portal is split into قضاياي / الاعتمادات / المستندات / الفواتير / المحادثة.
   - The employee portal is split into الرئيسية / طلباتي / الإجازات.
   - New endpoints feed these pages: `GET /portal/invoices/:id/pdf` (own invoices only), `GET /emp-portal/leaves` and `GET /emp-portal/advances` (own records only).
6. **Design screens with no data behind them are left out**, not mocked, per the no-fabricated-integrations rule:
   - «دفع الآن» (no payment gateway);
   - invoice due countdown (invoices have no due date yet);
   - performance criteria and quarterly reviews;
   - payslips, contract and GOSI certificate;
   - sick-leave balance.

   Each is an open item in `docs/MIGRATION.md`.
7. **Platform admin and mobile** are new surfaces in the design system with no backend yet. Each is its own milestone.

## Consequences

- `docs/05` screen descriptions stay valid for content and behaviour. Sizes and colours come from the design system.
- The prototype stays in the repo as a behavioural reference only.
- Inline styles in screens that still use the v1 variable names (`--gold`, `--line` …) resolve through the design system's v1 aliases. New work uses the v2 tokens.
