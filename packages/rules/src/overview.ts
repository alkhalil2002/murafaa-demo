import { daysLeft, urgencyOf, type Urgency } from "./dates.js";

/** Appointment kinds and statuses (legacy AppointmentType/Status). Labels: apptType.* */
export const APPOINTMENT_TYPES = ["FIRST_CONSULTATION", "CONTRACT_REVIEW", "FOLLOW_UP"] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];
export const APPOINTMENT_STATUSES = ["SCHEDULED", "CANCELLED", "DONE"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Case-derived calendar items (docs/06 §9). Labels: deadlines.* */
export const DEADLINE_KINDS = ["nextHearing", "objection", "poa", "reminder"] as const;
export type DeadlineKind = (typeof DEADLINE_KINDS)[number];

/** Smart-alert tiers, most severe first. Labels: alerts.tier.* */
export const ALERT_TIERS = ["critical", "important", "info"] as const;
export type AlertTier = (typeof ALERT_TIERS)[number];

/**
 * Tier of a deadline alert (legacy alerts.ts): overdue → critical, within
 * two days → important, anything later is not an alert.
 */
export function deadlineAlertTier(date: Date | string, at?: Date): AlertTier | null {
  const u: Urgency = urgencyOf(date, at);
  if (u === "overdue") return "critical";
  if (u === "critical") return "important";
  return null;
}

/** Stable most-severe-first order for alert lists. */
export function sortByTier<T extends { tier: AlertTier }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => ALERT_TIERS.indexOf(a.tier) - ALERT_TIERS.indexOf(b.tier));
}

/** "Today" deadline window: from 3 days overdue to 45 days ahead (legacy today.ts). */
export function inTodayDeadlineWindow(date: Date | string, at?: Date): boolean {
  const dl = daysLeft(date, at);
  return dl >= -3 && dl <= 45;
}

/** Activity-feed categories (legacy activity.ts). Labels: activity.category.* */
export const ACTIVITY_CATEGORIES = [
  "case",
  "approval",
  "client",
  "finance",
  "whatsapp",
  "hr",
  "other",
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

/** Category of an audit row from its action and entity; approvals win over their entity. */
export function activityCategory(action: string, entity: string | null): ActivityCategory {
  if (action.startsWith("approval.")) return "approval";
  switch (entity) {
    case "cases":
      return "case";
    case "clients":
    case "leads":
      return "client";
    case "finance":
      return "finance";
    case "whatsapp":
      return "whatsapp";
    case "hr":
      return "hr";
    default:
      return "other";
  }
}
