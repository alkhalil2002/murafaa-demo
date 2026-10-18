import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { noArabicLiterals } from "@murafaa/config/eslint";

const config = [
  { ignores: [".next/**", "next-env.d.ts"] },
  ...nextVitals,
  ...nextTs,
  // UI text must come from @murafaa/i18n (CLAUDE.md guardrail 6).
  { files: ["src/**/*.{ts,tsx}"], ...noArabicLiterals },
];

export default config;
