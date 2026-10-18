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

/** Display order for audit details; jsonb does not keep insertion order. */
const DETAIL_ORDER = ["role", "module", "level", "scope", "from", "to", "channel"];
const rank = (k: string) =>
  DETAIL_ORDER.includes(k) ? DETAIL_ORDER.indexOf(k) : DETAIL_ORDER.length;

/** A one-line summary of an audit entry's details (e.g. "role=LAWYER · module=FINANCE · level=VIEW"). */
export function describeAudit(after: unknown): string | null {
  if (!after || typeof after !== "object") return null;
  const parts = Object.entries(after as Record<string, unknown>)
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`);
  return parts.length ? parts.join(" · ") : null;
}
