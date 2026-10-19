/**
 * إدارة المنصة roles (owner, 2026-10-19). None of them sees office content;
 * that is enforced by the database (platform_api returns counts only). These
 * decide which platform actions each role may take.
 */
export const PLATFORM_ROLES = ["OWNER", "OPERATIONS", "BILLING", "SUPPORT"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PLATFORM_ACTIONS = [
  /** Add an office with its first partner. */
  "office.create",
  /** Suspend, reactivate, or move between trial and active. */
  "office.status",
  /** Paid-until and trial end. */
  "subscription.update",
  /** Invite members, change roles, disable, issue a new activation link. */
  "team.manage",
] as const;
export type PlatformAction = (typeof PLATFORM_ACTIONS)[number];

const MATRIX: Record<PlatformRole, readonly PlatformAction[]> = {
  OWNER: PLATFORM_ACTIONS,
  OPERATIONS: ["office.create", "office.status", "subscription.update"],
  BILLING: ["subscription.update"],
  SUPPORT: [],
};

/** Every role may view offices, usage and the audit log; actions are listed here. */
export function canPlatform(role: PlatformRole, action: PlatformAction): boolean {
  return MATRIX[role].includes(action);
}

export function platformActions(role: PlatformRole): PlatformAction[] {
  return [...MATRIX[role]];
}

/** Activation links last a day and open once (they still need the invited phone). */
export const PLATFORM_INVITE_TTL_MS = 24 * 60 * 60 * 1000;
/** Wrong codes across an activation before its link is burned. */
export const PLATFORM_INVITE_MAX_ATTEMPTS = 5;
