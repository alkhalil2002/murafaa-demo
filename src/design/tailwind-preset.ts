import type { Config } from 'tailwindcss';
import { chart } from './colors';
import { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing } from './typography';
import { spacing, borderRadius, shadow } from './spacing';

/**
 * Shared Tailwind preset. Usage in tailwind.config.ts:
 *
 *   import murafaaPreset from './src/design/tailwind-preset';
 *   export default { presets: [murafaaPreset], content: [...] }
 *
 * Colours resolve through CSS variables rather than literal hexes so a palette
 * swap stays a token change — this is what lets the v3 exploration recolour
 * the whole app by redefining variables on a wrapper element.
 *
 * They read the `--x-rgb` CHANNEL vars (`14 58 48`), not the `--x` hex vars,
 * because Tailwind can only apply an opacity modifier (`bg-ok/15`) when it can
 * inject `<alpha-value>` into the colour. Pointing these at a bare `var(--ok)`
 * silently drops the alpha and emits nothing at all — which is exactly the bug
 * this preset fixes across the HR and finance status chips.
 *
 * Every utility the app already ships keeps working: the nested `DEFAULT` and
 * suffix keys below regenerate `bg-parch`, `bg-parch-line`, `bg-bench-2`,
 * `text-ink-soft`, `bg-gold-soft`, `bg-advocate-2` exactly as before.
 */
const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        bench: {
          DEFAULT: 'rgb(var(--bench-rgb) / <alpha-value>)',
          2: 'rgb(var(--bench-2-rgb) / <alpha-value>)',
        },
        gold: {
          DEFAULT: 'rgb(var(--gold-rgb) / <alpha-value>)',
          soft: 'rgb(var(--gold-soft-rgb) / <alpha-value>)',
        },
        advocate: {
          DEFAULT: 'rgb(var(--advocate-rgb) / <alpha-value>)',
          2: 'rgb(var(--advocate-2-rgb) / <alpha-value>)',
        },
        parch: {
          DEFAULT: 'rgb(var(--parch-rgb) / <alpha-value>)',
          line: 'rgb(var(--parch-line-rgb) / <alpha-value>)',
          50: 'rgb(var(--parch-50-rgb) / <alpha-value>)',
          100: 'rgb(var(--parch-100-rgb) / <alpha-value>)',
          200: 'rgb(var(--parch-200-rgb) / <alpha-value>)',
          300: 'rgb(var(--parch-300-rgb) / <alpha-value>)',
          400: 'rgb(var(--parch-400-rgb) / <alpha-value>)',
          500: 'rgb(var(--parch-500-rgb) / <alpha-value>)',
          600: 'rgb(var(--parch-600-rgb) / <alpha-value>)',
          700: 'rgb(var(--parch-700-rgb) / <alpha-value>)',
          800: 'rgb(var(--parch-800-rgb) / <alpha-value>)',
          900: 'rgb(var(--parch-900-rgb) / <alpha-value>)',
          950: 'rgb(var(--parch-950-rgb) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink-rgb) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft-rgb) / <alpha-value>)',
        },
        line: 'rgb(var(--line-rgb) / <alpha-value>)',
        ok: 'rgb(var(--ok-rgb) / <alpha-value>)',
        warn: 'rgb(var(--warn-rgb) / <alpha-value>)',
        danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
        info: 'rgb(var(--info-rgb) / <alpha-value>)',
        wa: 'rgb(var(--wa-rgb) / <alpha-value>)',
        case: {
          active: 'rgb(var(--case-active-rgb) / <alpha-value>)',
          suspended: 'rgb(var(--case-suspended-rgb) / <alpha-value>)',
          closed: 'rgb(var(--case-closed-rgb) / <alpha-value>)',
        },
        outcome: {
          won: 'rgb(var(--outcome-won-rgb) / <alpha-value>)',
          partial: 'rgb(var(--outcome-partial-rgb) / <alpha-value>)',
          settled: 'rgb(var(--outcome-settled-rgb) / <alpha-value>)',
          lost: 'rgb(var(--outcome-lost-rgb) / <alpha-value>)',
        },
        urgency: {
          critical: 'rgb(var(--chart-critical-rgb) / <alpha-value>)',
          serious: 'rgb(var(--chart-serious-rgb) / <alpha-value>)',
          warning: 'rgb(var(--chart-warning-rgb) / <alpha-value>)',
          good: 'rgb(var(--chart-good-rgb) / <alpha-value>)',
        },
        chart: Object.fromEntries(chart.map((_, i) => [i + 1, `var(--chart-${i + 1})`])),
      },
      fontFamily: {
        sans: fontFamily.sans as unknown as string[],
        serif: fontFamily.serif as unknown as string[],
        display: fontFamily.display as unknown as string[],
        mono: fontFamily.mono as unknown as string[],
      },
      fontSize,
      fontWeight: fontWeight as unknown as Record<string, string>,
      lineHeight: lineHeight as unknown as Record<string, string>,
      letterSpacing,
      spacing,
      borderRadius,
      boxShadow: shadow,
      transitionTimingFunction: {
        brand: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '250ms',
        slow: '400ms',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          // RTL: toasts enter from the left edge, which is the trailing side.
          from: { opacity: '0', transform: 'translateX(-16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out backwards',
        'toast-in': 'toast-in 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
};

export default preset;
