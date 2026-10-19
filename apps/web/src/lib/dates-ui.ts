import { daysAgo, riyadhCalendarDate } from "@murafaa/rules";
import { t } from "@murafaa/i18n";

/** A date as YYYY-MM-DD on the Riyadh calendar, or an em dash (legacy fmt). */
export function fmtDate(iso: string | null | undefined): string {
  return iso ? riyadhCalendarDate(new Date(iso)).toISOString().slice(0, 10) : "—";
}

/** "today" / "N days ago" on the Riyadh calendar (legacy relTime). */
export function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const n = daysAgo(iso);
  return n <= 0 ? t("common.today") : t("common.daysAgo", { n: n.toLocaleString("ar-SA") });
}

/** Today on the Riyadh calendar as YYYY-MM-DD, to compare with date-only fields. */
export function todayIso(): string {
  return riyadhCalendarDate(new Date()).toISOString().slice(0, 10);
}
