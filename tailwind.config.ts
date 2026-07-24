import type { Config } from "tailwindcss";

/**
 * Design tokens mirror the prototype theme (see docs/05 §ملاحظات تصيير).
 * Colors are exposed as CSS variables in globals.css so both Tailwind and
 * raw CSS share one source of truth.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bench: "var(--bench)",
        "bench-2": "var(--bench-2)",
        gold: "var(--gold)",
        "gold-soft": "var(--gold-soft)",
        advocate: "var(--advocate)",
        "advocate-2": "var(--advocate-2)",
        parch: "var(--parch)",
        "parch-line": "var(--parch-line)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        line: "var(--line)",
        ok: "var(--ok)",
        warn: "var(--warn)",
      },
      fontFamily: {
        sans: ["var(--font-plex-arabic)", "system-ui", "sans-serif"],
        serif: ["var(--font-amiri)", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
