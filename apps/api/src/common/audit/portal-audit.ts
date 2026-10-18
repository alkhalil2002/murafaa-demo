import type { Tx } from "@murafaa/database";
import type { PortalPrincipal } from "../tenancy/principal.js";
import { writeAudit } from "./audit.js";

export type PortalMeta = { ip: string; requestId: string };

/** Portal actions are audited with no staff actor; the client or employee goes in `after`. */
export function portalAudit(
  tx: Tx,
  who: PortalPrincipal,
  meta: PortalMeta,
  entry: { action: string; entity: string; entityId: string; after?: Record<string, unknown> },
) {
  return writeAudit(tx, {
    officeId: who.officeId,
    actorId: null,
    ...entry,
    after: { portal: who.kind, subjectId: who.subjectId, ...entry.after },
    ...meta,
  });
}
