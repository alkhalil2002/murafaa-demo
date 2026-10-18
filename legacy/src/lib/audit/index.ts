import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";

/**
 * Audit logging (docs/02 §5, §9). Every sensitive access, mutation, and
 * permission decision lands here. Writes must never throw into the caller's
 * happy path — a logging failure is swallowed and reported, not propagated.
 */

export type AuditInput = {
  session: Pick<AppSession, "officeId" | "userId">;
  action: string;
  resource?: string;
  targetId?: string;
  /** "PERMIT" | "DENY" for permission decisions; omit for plain events. */
  decision?: "PERMIT" | "DENY";
  detail?: string;
  meta?: Prisma.InputJsonValue;
};

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        officeId: input.session.officeId,
        actorId: input.session.userId,
        action: input.action,
        resource: input.resource,
        targetId: input.targetId,
        decision: input.decision,
        detail: input.detail,
        meta: input.meta,
      },
    });
  } catch (err) {
    // Do not let audit failures break the request; surface for observability.
    console.error("[audit] failed to write audit log", err);
  }
}

/** System-actor variant for background jobs (no user in context). */
export async function logSystemAudit(
  officeId: string,
  action: string,
  detail?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { officeId, actorId: null, action, detail },
    });
  } catch (err) {
    console.error("[audit] failed to write system audit log", err);
  }
}
