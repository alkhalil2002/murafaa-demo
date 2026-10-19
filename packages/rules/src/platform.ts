/**
 * إدارة المنصة (owner, 2026-10-19): no plans or prices yet; billing is by
 * hand (the operator records the day an office is paid until); a suspended
 * office stays readable but nothing in it can change.
 */
export const OFFICE_STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED"] as const;
export type OfficeStatus = (typeof OFFICE_STATUSES)[number];

/** A suspended office is read-only for staff and both portals. */
export function officeReadOnly(status: OfficeStatus): boolean {
  return status === "SUSPENDED";
}

/**
 * The day the office's access is paid or granted until: the trial end for a
 * trial, the paid-until day for an active office, none once suspended.
 * Nothing is suspended automatically (that needs the jobs runner); the
 * screens highlight it and the operator decides.
 */
export function subscriptionDueDate(o: {
  status: OfficeStatus;
  trialEndsAt: string | null;
  paidUntil: string | null;
}): string | null {
  if (o.status === "TRIAL") return o.trialEndsAt;
  if (o.status === "ACTIVE") return o.paidUntil;
  return null;
}
