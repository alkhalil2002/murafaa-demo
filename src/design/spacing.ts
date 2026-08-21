/** 8pt grid, shared with Alkhalil so spacing reads the same across products. */
export const spacing = {
  0: '0',
  1: '0.25rem', // 4
  2: '0.5rem', // 8
  3: '0.75rem', // 12
  4: '1rem', // 16
  5: '1.25rem', // 20
  6: '1.5rem', // 24
  8: '2rem', // 32
  10: '2.5rem', // 40
  12: '3rem', // 48
  16: '4rem', // 64
  20: '5rem', // 80
  24: '6rem', // 96
} as const;

/**
 * Murafaa is a paper product: corners stay tight. `lg` is the ceiling for
 * surfaces; `full` is for pills and dots only.
 */
export const borderRadius = {
  none: '0',
  sm: '2px',
  md: '4px',
  lg: '8px',
  full: '9999px',
} as const;

/** Shadows are warm — tinted toward ink, never neutral gray on parchment. */
export const shadow = {
  sm: '0 1px 2px rgba(28, 26, 21, 0.05)',
  md: '0 4px 12px rgba(28, 26, 21, 0.07)',
  lg: '0 12px 32px rgba(28, 26, 21, 0.09)',
  xl: '0 24px 48px rgba(28, 26, 21, 0.13)',
  gold: '0 8px 24px rgba(194, 151, 75, 0.22)',
  bench: '0 8px 24px rgba(14, 58, 48, 0.18)',
} as const;

export const transition = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '400ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;
