/**
 * Murafaa design tokens — typed mirror of src/design/tokens.css.
 *
 * Import from here when a value is needed in TS (inline SVG fills, canvas,
 * PDF rendering). For anything expressible in markup, prefer the Tailwind
 * utility or the CSS variable so the palette stays swappable.
 */
export * from './colors';
export * from './typography';
export * from './spacing';
export { default as tailwindPreset } from './tailwind-preset';
