/**
 * Murafaa type system.
 *
 * Arabic-first: IBM Plex Sans Arabic carries the UI, Amiri carries headings
 * and anything that should read as a legal document. Both are loaded by the
 * Next font loader in layout.tsx, which is why the families reference CSS
 * variables rather than naming the font directly.
 */
export const fontFamily = {
  sans: ['var(--font-plex-arabic)', 'system-ui', 'sans-serif'],
  serif: ['var(--font-amiri)', 'Georgia', 'serif'],
  /** Headings, seals, and document chrome — the "court" voice. */
  display: ['var(--font-amiri)', 'Georgia', 'serif'],
  mono: ['ui-monospace', 'Menlo', 'Monaco', 'monospace'],
} as const;

export const fontSize = {
  xs: '0.75rem', // 12
  sm: '0.875rem', // 14
  base: '1rem', // 16
  lg: '1.125rem', // 18
  xl: '1.25rem', // 20
  '2xl': '1.5rem', // 24
  '3xl': '1.875rem', // 30
  '4xl': '2.25rem', // 36
  '5xl': '3rem', // 48
  '6xl': '3.75rem', // 60
} as const;

export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * Arabic script needs more leading than Latin — the base body line-height in
 * globals.css is 1.7 for exactly this reason. `normal` matches it so the
 * component library and the legacy stylesheet agree.
 */
export const lineHeight = {
  none: 1,
  tight: 1.25,
  snug: 1.4,
  normal: 1.7,
  relaxed: 1.85,
  loose: 2,
} as const;

export const letterSpacing = {
  tight: '-0.01em',
  normal: '0',
  wide: '0.04em',
  wider: '0.08em',
  widest: '0.16em',
} as const;
