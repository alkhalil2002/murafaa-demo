/**
 * Deadline date math (docs/06 §1, §9). The whole platform anchors "today" to
 * Asia/Riyadh (me-central2 / PDPL residency) so urgency bands match what Saudi
 * users see. All helpers are pure given an explicit `now`, which keeps them
 * unit-testable and timezone-deterministic.
 */

export const RIYADH_TZ = "Asia/Riyadh";
const DAY_MS = 86_400_000;

/** Current instant. Wrapped so tests can inject a fixed clock. */
export function now(): Date {
  return new Date();
}

/**
 * The calendar date in Riyadh for a given instant, as a UTC-midnight Date.
 * Using UTC midnight of the Riyadh Y/M/D gives stable whole-day differences
 * regardless of the server's local zone.
 */
export function riyadhCalendarDate(at: Date = now()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: RIYADH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
  // en-CA formats as YYYY-MM-DD.
  return new Date(`${parts}T00:00:00.000Z`);
}

/**
 * Whole calendar days from today (Riyadh) until `date` (docs/06 §9 daysLeft).
 * Negative ⇒ overdue, 0 ⇒ due today. Compares calendar days, not instants, so
 * time-of-day never flips the sign.
 */
export function daysLeft(date: Date | string, at: Date = now()): number {
  const target = riyadhCalendarDate(new Date(date));
  const today = riyadhCalendarDate(at);
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

/** Today (Riyadh) + n days, as a UTC-midnight Date (docs/06 dateInDays). */
export function dateInDays(n: number, at: Date = now()): Date {
  const base = riyadhCalendarDate(at);
  return new Date(base.getTime() + n * DAY_MS);
}

/** A base date + n days (docs/06 §1 _plus30 = plusDays(judgment, 30)). */
export function plusDays(date: Date | string, n: number): Date {
  const base = riyadhCalendarDate(new Date(date));
  return new Date(base.getTime() + n * DAY_MS);
}

/** A base date − n days (docs/06 _minusDays; used for reminder lead time). */
export function minusDays(date: Date | string, n: number): Date {
  return plusDays(date, -n);
}

/** Objection deadline = judgment date + 30 calendar days (docs/06 §1). */
export function objectionDeadline(judgmentDate: Date | string): Date {
  return plusDays(judgmentDate, 30);
}

/** Urgency banding for deadline coloring/sorting (docs/06 §9). */
export type Urgency = "overdue" | "critical" | "soon" | "upcoming" | "normal";

/**
 * Band a deadline by days remaining (docs/06 §9 / BR-CAL-urgency-bands):
 * <0 overdue · ≤2 critical · ≤7 soon · ≤30 upcoming · else normal.
 */
export function urgencyOf(date: Date | string, at: Date = now()): Urgency {
  const dl = daysLeft(date, at);
  if (dl < 0) return "overdue";
  if (dl <= 2) return "critical";
  if (dl <= 7) return "soon";
  if (dl <= 30) return "upcoming";
  return "normal";
}
