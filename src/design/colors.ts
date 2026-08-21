/**
 * Murafaa brand colours.
 *
 * Structure mirrors the Alkhalil `design-tokens` package so both products are
 * built the same way, but every value here is Murafaa's own courtroom palette
 * — carried over unchanged from the prototype theme (docs/05 §ملاحظات تصيير).
 *
 * Do not edit a hex without design approval: the chart ramp and the status
 * band below are contrast-validated (see `chart` for the measurements).
 */

/** The three voices of the interface: the bench, the accent, the opponent. */
export const brand = {
  bench: '#0e3a30',
  bench2: '#0a2a22',
  gold: '#c2974b',
  goldSoft: '#e7d2a4',
  advocate: '#7a2e33',
  advocate2: '#5c2025',
} as const;

/**
 * Warm neutral ramp, parchment → ink.
 *
 * The five values the app already shipped are anchors and keep their exact
 * hexes: 100 = --parch, 300 = --parch-line, 400 = --line, 700 = --ink-soft,
 * 900 = --ink. The rest fill the gaps so components can step through tone
 * without inventing one-off colours at the call site.
 */
export const parch = {
  50: '#fdfbf5',
  100: '#faf6ec',
  200: '#f2ebd9',
  300: '#eadfc8',
  400: '#d9cfb8',
  500: '#b8ad93',
  600: '#8c8370',
  700: '#5a5446',
  800: '#35312a',
  900: '#1c1a15',
  950: '#0f0e0b',
} as const;

export const semantic = {
  ok: '#2e7d5b',
  warn: '#b25c1e',
  danger: brand.advocate,
  info: '#3d6fd0',
  whatsapp: '#25d366',
} as const;

/** Case lifecycle — mirrors the `CaseStatus` enum in prisma/schema.prisma. */
export const caseStatus = {
  active: '#2e7d5b',
  suspended: '#b25c1e',
  closed: '#8c8370',
} as const;

/** Case outcome — mirrors the `CaseOutcome` enum, feeds the win-rate KPI. */
export const caseOutcome = {
  won: '#2f7d55',
  partial: '#c9a227',
  settled: '#3d6fd0',
  lost: '#b3242f',
} as const;

/**
 * Deadline urgency bands. Reserved for state only — never reused as a
 * categorical chart slot (see `chart`).
 */
export const urgency = {
  critical: '#b3242f',
  serious: '#d1741b',
  warning: '#c9a227',
  good: '#2f7d55',
} as const;

/**
 * Categorical chart ramp, in fixed order.
 *
 * ΔE 11.1 simulated / 22.8 normal vision. Never cycled — a 7th series folds
 * into "أخرى" rather than generating a hue.
 *
 * The brand colours are deliberately NOT chart hues: bench and advocate fall
 * outside the lightness band, bench and ok read as gray at chart scale, and
 * gold measures 2.62:1 against the surface. They stay as chrome.
 */
export const chart = ['#008a72', '#b8541a', '#3d6fd0', '#b03a5e', '#8f9111', '#8a4fc0'] as const;

export const colors = {
  brand,
  parch,
  semantic,
  caseStatus,
  caseOutcome,
  urgency,
  chart,
} as const;

export type BrandColor = keyof typeof brand;
export type ParchShade = keyof typeof parch;
export type CaseStatusColor = keyof typeof caseStatus;
export type CaseOutcomeColor = keyof typeof caseOutcome;
export type UrgencyBand = keyof typeof urgency;
