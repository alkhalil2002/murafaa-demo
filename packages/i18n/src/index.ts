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

/** Display name of a role (keys role.partner, role.lawyer, …). */
export function roleLabel(role: string, locale: Locale = defaultLocale): string {
  return t(`role.${role.toLowerCase()}` as MessageKey, undefined, locale);
}

/** Display name of a permission module (keys module.cases, module.finance, …). */
export function moduleLabel(module: string, locale: Locale = defaultLocale): string {
  return t(`module.${module.toLowerCase()}` as MessageKey, undefined, locale);
}

/** Display name of a permission level (keys permLevel.NONE … permLevel.FULL). */
export function permLevelLabel(level: string, locale: Locale = defaultLocale): string {
  return t(`permLevel.${level}` as MessageKey, undefined, locale);
}

/** Date and time in Riyadh, e.g. for audit entries (legacy formatWhen). */
export function formatWhen(value: Date | string, locale: Locale = defaultLocale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-SA", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
