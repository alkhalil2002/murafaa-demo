import { CaseScope, caseScopeOf, effectiveRole, type OfficePolicy } from "@murafaa/auth";
import { caseAssignees, cases, type Tx } from "@murafaa/database";
import { and, eq, exists, isNull, type SQL } from "drizzle-orm";
import type { Principal } from "../../common/tenancy/principal.js";

/**
 * docs/04 layer 3 as a SQL condition on `cases`: roles with ASSIGNED scope
 * only ever load cases they are assigned to. Every case query includes it, so
 * an out-of-scope case is simply not found.
 */
export function caseVisibility(tx: Tx, policy: OfficePolicy, p: Principal): SQL {
  const live = isNull(cases.deletedAt);
  if (caseScopeOf(policy, effectiveRole(p)) === CaseScope.ALL) return live;
  return and(
    live,
    exists(
      tx
        .select({ one: caseAssignees.id })
        .from(caseAssignees)
        .where(and(eq(caseAssignees.caseId, cases.id), eq(caseAssignees.userId, p.userId))),
    ),
  )!;
}
