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
