/**
 * Team Pulse (نبض الفريق) points. Each real action earns a fixed default; an
 * office may override a kind's points. No self-reported points.
 * Labels: performanceEventKind.*
 */

export const PERFORMANCE_EVENT_KINDS = [
  "TASK_COMPLETED",
  "HEARING_RECORDED",
  "DOCUMENT_GENERATED",
  "INVOICE_CREATED",
  "LEAD_CONVERTED",
] as const;
export type PerformanceEventKind = (typeof PERFORMANCE_EVENT_KINDS)[number];

export const PERFORMANCE_POINTS: Record<PerformanceEventKind, number> = {
  TASK_COMPLETED: 5,
  HEARING_RECORDED: 15,
  DOCUMENT_GENERATED: 8,
  INVOICE_CREATED: 10,
  LEAD_CONVERTED: 20,
};

/** Points for an event: the office override when set, else the default. */
export function pointsFor(kind: PerformanceEventKind, override?: number | null): number {
  return override ?? PERFORMANCE_POINTS[kind];
}

/** An office override must be a whole, non-negative number of points. */
export function isValidPoints(points: number): boolean {
  return Number.isInteger(points) && points >= 0;
}

export const PULSE_WINDOWS = ["today", "week", "month"] as const;
export type PulseWindow = (typeof PULSE_WINDOWS)[number];

/** Riyadh is UTC+3 all year (no daylight saving). */
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Start of a Pulse window: Riyadh midnight today, the 1st of the Riyadh month,
 * or the last 7 days. Legacy used the server's local time, which is UTC on
 * Cloud Run and shifted "today" by three hours.
 */
export function pulseSince(window: PulseWindow, at: Date = new Date()): Date {
  if (window === "week") return new Date(at.getTime() - 7 * 24 * 60 * 60 * 1000);
  const riyadh = new Date(at.getTime() + RIYADH_OFFSET_MS);
  const day = window === "today" ? riyadh.getUTCDate() : 1;
  return new Date(Date.UTC(riyadh.getUTCFullYear(), riyadh.getUTCMonth(), day) - RIYADH_OFFSET_MS);
}

/** Share of a person's assigned tasks that are done, as a whole percentage. */
export function completionRatePct(done: number, assigned: number): number {
  return assigned > 0 ? Math.round((done / assigned) * 100) : 0;
}
