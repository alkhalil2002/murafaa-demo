import { ar, type MessageKey } from "./ar";

export type { MessageKey };

/**
 * Translate a message key. Arabic is the only active locale for now, but every
 * lookup goes through here so adding English later is a data change, not a
 * component rewrite.
 *
 * Supports {name}-style interpolation:
 *   t("common.welcome") + params → "أهلاً {name}"
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const template = ar[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** The active text direction. Arabic-first ⇒ always RTL for now. */
export const dir = "rtl" as const;
export const locale = "ar" as const;
