import type { PermModule } from "@prisma/client";
import type { AppSession } from "@/lib/auth/types";
import { logAudit } from "@/lib/audit";
import {
  canField,
  canModule,
  canViewCase,
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

export type PermDenyKind = "module" | "field" | "scope";

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
  const policy = await policyFor(session);
  if (canModule(policy, session.role, module, action)) return;
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
  if (canField(policy, session.role, resource, field)) return;
  await logAudit({
    session,
    action: `field.${resource}.${field}`,
    resource,
    decision: "DENY",
    detail: "field access denied",
  });
  throw new PermissionError("field");
}

/** Layer 2 — non-throwing check, for filtering fields out of a response. */
export async function mayViewField(
  session: AppSession,
  resource: string,
  field: string,
): Promise<boolean> {
  const policy = await policyFor(session);
  return canField(policy, session.role, resource, field);
}

/** Layer 3 — require the user may see a specific case; audit + throw. */
export async function requireCaseAccess(
  session: AppSession,
  caseId: string,
  assigneeIds: readonly string[],
): Promise<void> {
  const policy = await policyFor(session);
  if (canViewCase(policy, session.role, session.userId, assigneeIds)) return;
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
