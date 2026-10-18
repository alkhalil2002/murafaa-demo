import { effectiveRole, type PermAction } from "./engine.js";
import { Role } from "./enums.js";

/**
 * Partner-only actions (legacy PARTNER_ONLY checks). These sit outside the
 * module matrix: no module level grants them, so an office can't hand them
 * out by editing permissions.
 */
export const PARTNER_ONLY_ACTIONS = [
  "permissions.manage", // role matrix, case scope, user roles
  "security.audit.view",
  "security.ipAllowlist.set",
  "finance.requireApproval.set",
  "recycleBin.purge",
  "billing.view",
  "office.branding.update",
  "office.tax.update", // the ZATCA tax profile printed on every invoice
  "rolePreview.start",
  "conflict.waive", // documented consent to act despite a conflict (docs/06 §4)
] as const;
export type PartnerOnlyAction = (typeof PARTNER_ONLY_ACTIONS)[number];

/**
 * Whether the session may perform a partner-only action. Uses the EFFECTIVE
 * role, so a partner previewing another role loses partner powers for the
 * preview. Starting a preview is the exception: it checks the REAL role,
 * otherwise a partner could never switch back.
 */
export function canPartnerOnly(
  session: { role: Role; previewRole?: Role | null },
  action: PartnerOnlyAction,
): boolean {
  const role = action === "rolePreview.start" ? session.role : effectiveRole(session);
  return role === Role.PARTNER;
}

/**
 * Role preview is view-only: while previewing, only "view" actions are
 * allowed, whatever either role's grants. The UI uses this to hide write
 * controls; the API guard enforces it.
 */
export function previewAllows(session: { previewRole?: Role | null }, action: PermAction): boolean {
  return !session.previewRole || action === "view";
}
