import { ar, type MessageKey } from "./ar.js";
import { en } from "./en.js";

export { ar, en };
export type { MessageKey };

export type Locale = "ar" | "en";
export type Messages = Record<MessageKey, string>;

export const defaultLocale: Locale = "ar";

export function dirOf(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Full catalog for a locale, falling back to Arabic for keys not yet translated. */
export function messagesFor(locale: Locale): Messages {
  return locale === "ar" ? ar : { ...ar, ...en };
}

/**
 * Translate a message key with {name}-style interpolation.
 *   t("today.since", { n: 3 }) → "منذ 3 يوم"
 */
export function t(
  key: MessageKey,
  params?: Record<string, string | number>,
  locale: Locale = defaultLocale,
): string {
  const template = messagesFor(locale)[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Format integer halalas as a SAR amount, e.g. "6,900.00 ر.س". Display only. */
export function formatSar(halalas: number, locale: Locale = defaultLocale): string {
  const riyals = halalas / 100;
  const amount = riyals.toLocaleString(locale === "ar" ? "ar-SA" : "en-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount} ${t("common.currency.sar", undefined, locale)}`;
}
