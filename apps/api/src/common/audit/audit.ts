import { auditLog, type Tx } from "@murafaa/database";

/** Append one audit entry inside the caller's tenant transaction (PDPL access logging). */
export async function writeAudit(
  tx: Tx,
  entry: {
    officeId: string;
    actorId: string | null;
    action: string;
    entity: string;
    entityId?: string | null;
    after?: Record<string, unknown>;
    ip?: string | null;
    requestId?: string | null;
  },
): Promise<void> {
  await tx.insert(auditLog).values({
    officeId: entry.officeId,
    actorId: entry.actorId,
    createdBy: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    after: entry.after ?? null,
    ip: entry.ip ?? null,
    requestId: entry.requestId ?? null,
  });
}
