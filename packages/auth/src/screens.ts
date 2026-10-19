import { canModule, effectiveRole, type OfficePolicy } from "./engine.js";
import { PermModule, type Role } from "./enums.js";

/**
 * Screen → module map (docs/04 layer 1, prototype VIEW2MOD + FREE_VIEWS). Web
 * and mobile build their navigation from this; the API still enforces every
 * action. "FREE" screens are open to every signed-in role; their sections
 * still filter by module (like the legacy today page).
 *
 * Legacy deviated from docs/04 on four screens; docs win (CLAUDE.md), and the
 * stricter legacy behaviour stays where it is an action, not a screen:
 *   dashboard  docs FREE        · legacy REPORTS
 *   kb         docs DOCUMENTS   · legacy AI
 *   billing    docs FINANCE     · legacy partner only (billing data stays partner-only: "billing.view")
 *   perms      docs PERMISSIONS · legacy partner only (changes stay partner-only: "permissions.manage")
 */
export const SCREEN_ACCESS = {
  // FREE_VIEWS
  today: "FREE",
  dashboard: "FREE",
  settings: "FREE",
  notifications: "FREE",
  clientportal: "FREE", // separate client login
  empportal: "FREE", // separate employee login
  // Not in the prototype map; open to every signed-in user, results/data filtered per module.
  search: "FREE",
  accountSecurity: "FREE",
  // VIEW2MOD
  cases: PermModule.CASES,
  workspace: PermModule.CASES,
  copilot: PermModule.AI,
  clients: PermModule.CLIENTS,
  leads: PermModule.CLIENTS,
  documents: PermModule.DOCUMENTS,
  kb: PermModule.DOCUMENTS,
  finance: PermModule.FINANCE,
  billing: PermModule.FINANCE,
  hr: PermModule.HR,
  journey: PermModule.REPORTS,
  activity: PermModule.REPORTS,
  perms: PermModule.PERMISSIONS,
  whatsapp: PermModule.WHATSAPP,
  deadlines: PermModule.APPOINTMENTS,
  appointments: PermModule.APPOINTMENTS,
  tasks: PermModule.TASKS,
  alerts: PermModule.ALERTS,
  pulse: PermModule.PULSE,
} as const satisfies Record<string, PermModule | "FREE">;
export type Screen = keyof typeof SCREEN_ACCESS;

/** Whether a session may open a screen (view level on its module). */
export function canSeeScreen(
  policy: OfficePolicy,
  session: { role: Role; previewRole?: Role | null },
  screen: Screen,
): boolean {
  const access = SCREEN_ACCESS[screen];
  return access === "FREE" || canModule(policy, effectiveRole(session), access, "view");
}

/**
 * Global search: each result category needs view access to its module.
 * Cases, documents and tasks are further limited to cases in the caller's
 * row scope (docs/04 layer 3).
 */
export const SEARCH_CATEGORY_MODULE = {
  cases: PermModule.CASES,
  clients: PermModule.CLIENTS,
  leads: PermModule.CLIENTS,
  documents: PermModule.DOCUMENTS,
  invoices: PermModule.FINANCE,
  tasks: PermModule.TASKS,
  employees: PermModule.HR,
} as const satisfies Record<string, PermModule>;

/**
 * Session rules. Idle sign-out after 20 minutes (legacy idle-logout), enforced
 * by the API as well as the browser; sessions last at most 30 days (legacy
 * Auth.js default).
 */
export const SESSION_POLICY = {
  idleTimeoutMs: 20 * 60 * 1000,
  absoluteTtlMs: 30 * 24 * 60 * 60 * 1000,
  /** Refresh last-seen at most this often, to avoid a write on every request. */
  touchIntervalMs: 60 * 1000,
  activityEvents: ["mousemove", "keydown", "click", "scroll", "touchstart"],
} as const;

/**
 * Client and employee portal sessions (legacy: 7 days). Portal users come
 * back rarely, so there is no short idle timeout; the session ends after
 * 7 days, on sign-out, or as soon as the client or employee is deactivated.
 */
export const PORTAL_SESSION_POLICY = {
  idleTimeoutMs: 7 * 24 * 60 * 60 * 1000,
  absoluteTtlMs: 7 * 24 * 60 * 60 * 1000,
  touchIntervalMs: 60 * 1000,
} as const;

/**
 * إدارة المنصة sessions: the strongest account in the system, so the
 * shortest life (15 minutes idle, 12 hours at most).
 */
export const PLATFORM_SESSION_POLICY = {
  idleTimeoutMs: 15 * 60 * 1000,
  absoluteTtlMs: 12 * 60 * 60 * 1000,
  touchIntervalMs: 60 * 1000,
} as const;

/** Whether a session is still usable at `now` (not revoked, not idle too long, not past its lifetime). */
export function isSessionLive(
  s: { expiresAt: Date; lastSeenAt: Date; revokedAt: Date | null },
  now: Date,
  policy: { idleTimeoutMs: number } = SESSION_POLICY,
): boolean {
  if (s.revokedAt) return false;
  if (s.expiresAt.getTime() <= now.getTime()) return false;
  return now.getTime() - s.lastSeenAt.getTime() < policy.idleTimeoutMs;
}
