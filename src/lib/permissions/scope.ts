import { CaseScope, type Prisma } from "@prisma/client";
import type { AppSession } from "@/lib/auth/types";
import { caseScopeOf } from "./engine";
import { loadOfficePolicy } from "./policy";

/**
 * Layer 3 (row scope) as a Prisma `where` fragment for the cases table. Every
 * case query MUST spread this so ASSIGNED-scoped roles only ever load cases
 * they're assigned to — enforced in the query, never by UI filtering (docs/04).
 * Always office-scoped and excludes soft-deleted rows.
 */
export async function caseScopeWhere(
  session: AppSession,
): Promise<Prisma.CaseWhereInput> {
  const policy = await loadOfficePolicy(session.officeId);
  const base: Prisma.CaseWhereInput = { officeId: session.officeId, deletedAt: null };
  if (caseScopeOf(policy, session.role) === CaseScope.ALL) return base;
  return { ...base, assignees: { some: { userId: session.userId } } };
}

/** Whether the session may see a specific case, honoring row scope. */
export async function isCaseVisible(
  session: AppSession,
  caseId: string,
  assigneeUserIds: readonly string[],
): Promise<boolean> {
  const policy = await loadOfficePolicy(session.officeId);
  if (caseScopeOf(policy, session.role) === CaseScope.ALL) return true;
  return assigneeUserIds.includes(session.userId);
}
