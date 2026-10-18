import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Any Arabic letter. UI text must come from @murafaa/i18n (CLAUDE.md guardrail 6). */
const ARABIC = "/[\\u0600-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF]/";
const I18N_MESSAGE = "Arabic text must come from @murafaa/i18n, not a literal.";

/** Base config for every TypeScript workspace. */
export const base = tseslint.config(
  { ignores: ["**/dist/**", "**/.next/**", "**/coverage/**", "**/src/gen/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // Tests poke at untyped JSON (OpenAPI documents, HTTP bodies).
    files: ["test/**/*.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);

/** Forbid Arabic string literals and JSX text — used by apps/web and apps/mobile. */
export const noArabicLiterals = {
  rules: {
    "no-restricted-syntax": [
      "error",
      { selector: `Literal[value=${ARABIC}]`, message: I18N_MESSAGE },
      { selector: `TemplateElement[value.raw=${ARABIC}]`, message: I18N_MESSAGE },
      { selector: `JSXText[value=${ARABIC}]`, message: I18N_MESSAGE },
    ],
  },
};
