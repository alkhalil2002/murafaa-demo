import type { MessageKey } from "./ar.js";

/**
 * English catalog. Optional per key while the product is Arabic-only; any
 * missing key falls back to Arabic in t().
 */
export const en: Partial<Record<MessageKey, string>> = {
  "app.name": "Murafaa",
};
