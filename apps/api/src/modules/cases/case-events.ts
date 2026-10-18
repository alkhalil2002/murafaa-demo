import { caseEvents, type Tx } from "@murafaa/database";
import type { CaseEventType } from "@murafaa/rules";

/**
 * Append a timeline event (legacy logCaseEvent). System events carry an i18n
 * key and params ("@key" values are translated at read time); user-written
 * entries carry text. The audit log is separate and also written.
 */
export async function logCaseEvent(
  tx: Tx,
  e: {
    officeId: string;
    caseId: string;
    type: CaseEventType;
    actorUserId: string | null;
    messageKey?: string;
    params?: Record<string, string | number>;
    text?: string;
    procedureRequestId?: string;
    approvalId?: string;
  },
): Promise<void> {
  await tx.insert(caseEvents).values({
    officeId: e.officeId,
    caseId: e.caseId,
    type: e.type,
    messageKey: e.messageKey ?? null,
    params: e.params ?? null,
    text: e.text ?? null,
    actorUserId: e.actorUserId,
    createdBy: e.actorUserId,
    procedureRequestId: e.procedureRequestId ?? null,
    approvalId: e.approvalId ?? null,
  });
}
