import { CaseEventType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Append a case timeline event (prototype logEvent). This is the per-case
 * activity trail, distinct from the office-wide AuditLog: timeline events are
 * user-facing history, audit rows are the compliance log. Both may be written
 * for one action.
 */
export async function logCaseEvent(
  db: Db,
  params: {
    officeId: string;
    caseId: string;
    type: CaseEventType;
    description: string;
    actor?: string;
    actorUserId?: string;
    procedureRequestId?: string;
    approvalId?: string;
  },
): Promise<void> {
  await db.caseEvent.create({
    data: {
      officeId: params.officeId,
      caseId: params.caseId,
      type: params.type,
      description: params.description,
      actor: params.actor,
      actorUserId: params.actorUserId,
      procedureRequestId: params.procedureRequestId,
      approvalId: params.approvalId,
    },
  });
}
