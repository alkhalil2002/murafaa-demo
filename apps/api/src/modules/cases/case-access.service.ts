import { Injectable } from "@nestjs/common";
import { ErrorCode } from "@murafaa/contracts";
import { cases, type Tx, users } from "@murafaa/database";
import { and, eq, isNull } from "drizzle-orm";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import { PolicyService } from "../../common/permissions/policy.service.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { caseVisibility } from "./case-scope.js";

export type Meta = { ip: string; requestId: string };
export type CaseRow = typeof cases.$inferSelect;

/** Shared access to one case for the cases, hearings and procedural-request services. */
@Injectable()
export class CaseAccess {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly policies: PolicyService,
  ) {}

  /**
   * Run `fn` in one transaction on a case the caller may see, or 404. An
   * attempt on a case that exists but is out of scope is audited in its own
   * transaction, so the 404 rollback doesn't erase it.
   */
  async withCase<T>(
    p: Principal,
    caseId: string,
    meta: Meta,
    fn: (tx: Tx, c: CaseRow) => Promise<T>,
  ): Promise<T> {
    const policy = await this.policies.forOffice(p.officeId);
    const outcome = await this.tenantDb.run(async (tx) => {
      const [c] = await tx
        .select()
        .from(cases)
        .where(and(eq(cases.id, caseId), caseVisibility(tx, policy, p)));
      if (!c) {
        const [exists] = await tx
          .select({ id: cases.id })
          .from(cases)
          .where(and(eq(cases.id, caseId), isNull(cases.deletedAt)));
        return { found: false as const, outOfScope: Boolean(exists) };
      }
      return { found: true as const, value: await fn(tx, c) };
    });
    if (outcome.found) return outcome.value;
    if (outcome.outOfScope) {
      await this.tenantDb.run((tx) =>
        writeAudit(tx, {
          officeId: p.officeId,
          actorId: p.userId,
          action: "access.case.scope",
          entity: "cases",
          entityId: caseId,
          ...meta,
        }),
      );
    }
    throw new ApiException(ErrorCode.NOT_FOUND);
  }
}

/**
 * An optional assignee must be a live user of this office. Foreign keys are
 * checked without RLS, so the office is verified here through an RLS read.
 */
export async function assertOfficeUser(
  tx: Tx,
  userId: string | null | undefined,
  path: string,
): Promise<void> {
  if (!userId) return;
  const [u] = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)));
  if (!u)
    throw new ApiException(ErrorCode.VALIDATION_FAILED, [{ path, message: "errors.NOT_FOUND" }]);
}
