import type { PermModule } from "@prisma/client";
import type { AppSession } from "@/lib/auth/types";
import { logAudit } from "@/lib/audit";
import {
  canField,
  canModule,
  canViewCase,
  effectiveRole,
  type OfficePolicy,
  type PermAction,
} from "./engine";
import { loadOfficePolicy } from "./policy";

/**
 * Server-side enforcement (docs/04). The UI only hides; THIS is what actually
 * denies. Every guard loads the office policy, decides, and audits denials.
 * All checks throw PermissionError on failure so a handler cannot forget to
 * branch on a boolean.
 */

export type PermDenyKind = "module" | "field" | "scope" | "subscription";

export class PermissionError extends Error {
  constructor(
    readonly kind: PermDenyKind,
    message = "permission denied",
  ) {
    super(message);
    this.name = "PermissionError";
  }
}

async function policyFor(session: AppSession): Promise<OfficePolicy> {
  return loadOfficePolicy(session.officeId);
}

/** Layer 1 — require module access; audit + throw on denial. */
export async function requireModule(
  session: AppSession,
  module: PermModule,
  action: PermAction,
): Promise<void> {
  // While previewing another role (docs/05 "معاينة حسب الدور"), every
  // mutation is blocked outright regardless of either role's real grants —
  // preview is view-only by design, never a way to act as the previewed role.
  if (session.previewRole && action !== "view") {
    await logAudit({
      session,
      action: `access.${module}.${action}`,
      resource: module,
      decision: "DENY",
      detail: "blocked: role preview is view-only",
    });
    throw new PermissionError("module");
  }
  // Subscription gate. An office past its trial + grace window is read-only:
  // every mutation is refused here, at the same chokepoint as role preview, so
  // no individual handler can forget the check. Reads are never gated — a firm
  // keeps access to its own case files regardless of billing state.
  if (action !== "view") {
    const { getAccess } = await import("@/server/subscription");
    const access = await getAccess(session.officeId);
    if (access.writeLocked) {
      await logAudit({
        session,
        action: `access.${module}.${action}`,
        resource: module,
        decision: "DENY",
        detail: `blocked: subscription ${access.state}`,
      });
      throw new PermissionError("subscription");
    }
  }

  const policy = await policyFor(session);
  if (canModule(policy, effectiveRole(session), module, action)) return;
  await logAudit({
    session,
    action: `access.${module}.${action}`,
    resource: module,
    decision: "DENY",
    detail: "module access denied",
  });
  throw new PermissionError("module");
}

/** Layer 2 — require field access. Returns nothing; throws on denial. */
export async function requireField(
  session: AppSession,
  resource: string,
  field: string,
): Promise<void> {
  const policy = await policyFor(session);
  if (canField(policy, effectiveRole(session), resource, field)) return;
  await logAudit({
    session,
    action: `field.${resource}.${field}`,
    resource,
    decision: "DENY",
    detail: "field access denied",
  });
  throw new PermissionError("field");
}

/**
 * Layer 1 — non-throwing module check, for hiding UI controls a role cannot use
 * (the server still enforces on the action). Mirrors requireModule without the
 * throw/audit.
 */
export async function canAction(
  session: AppSession,
  module: PermModule,
  action: PermAction,
): Promise<boolean> {
  if (session.previewRole && action !== "view") return false;
  // Mirror the subscription gate in requireModule so a read-only office does
  // not see edit controls it cannot use.
  if (action !== "view") {
    const { getAccess } = await import("@/server/subscription");
    if ((await getAccess(session.officeId)).writeLocked) return false;
  }
  const policy = await policyFor(session);
  return canModule(policy, effectiveRole(session), module, action);
}

/** Layer 2 — non-throwing check, for filtering fields out of a response. */
export async function mayViewField(
  session: AppSession,
  resource: string,
  field: string,
): Promise<boolean> {
  const policy = await policyFor(session);
  return canField(policy, effectiveRole(session), resource, field);
}

/** Layer 3 — require the user may see a specific case; audit + throw. */
export async function requireCaseAccess(
  session: AppSession,
  caseId: string,
  assigneeIds: readonly string[],
): Promise<void> {
  const policy = await policyFor(session);
  if (canViewCase(policy, effectiveRole(session), session.userId, assigneeIds)) return;
  await logAudit({
    session,
    action: "case.view",
    resource: "cases",
    targetId: caseId,
    decision: "DENY",
    detail: "case out of scope",
  });
  throw new PermissionError("scope");
}
