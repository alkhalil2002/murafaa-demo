import { Injectable } from "@nestjs/common";
import { type createCandidateBody, ErrorCode } from "@murafaa/contracts";
import { candidates } from "@murafaa/database";
import { CANDIDATE_STAGES, stepStage } from "@murafaa/rules";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import type { Meta } from "../cases/case-access.service.js";

/**
 * التوظيف (legacy server/hr/recruitment.ts): a four-stage pipeline moved one
 * step at a time. Reaching HIRED does not create the employee; that stays the
 * "موظف جديد" form (a hire needs salary and hire date).
 */
@Injectable()
export class RecruitmentService {
  constructor(private readonly tenantDb: TenantDb) {}

  list() {
    return this.tenantDb.run((tx) =>
      tx
        .select({
          id: candidates.id,
          name: candidates.name,
          roleTitle: candidates.roleTitle,
          source: candidates.source,
          stage: candidates.stage,
        })
        .from(candidates)
        .where(isNull(candidates.deletedAt))
        .orderBy(desc(candidates.createdAt)),
    );
  }

  create(p: Principal, input: z.infer<typeof createCandidateBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [row] = await tx
        .insert(candidates)
        .values({ officeId: p.officeId, ...input, createdBy: p.userId })
        .returning({ id: candidates.id });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "candidate.create",
        entity: "candidates",
        entityId: row!.id,
        ...meta,
      });
      return { id: row!.id };
    });
  }

  move(p: Principal, id: string, direction: 1 | -1, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [c] = await tx
        .select({ stage: candidates.stage })
        .from(candidates)
        .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
        .for("update");
      if (!c) throw new ApiException(ErrorCode.NOT_FOUND);
      const next = stepStage(CANDIDATE_STAGES, c.stage, direction);
      if (next === c.stage) return;
      await tx
        .update(candidates)
        .set({ stage: next, updatedBy: p.userId })
        .where(eq(candidates.id, id));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "candidate.move",
        entity: "candidates",
        entityId: id,
        after: { stage: next },
        ...meta,
      });
    });
  }

  remove(p: Principal, id: string, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const updated = await tx
        .update(candidates)
        .set({ deletedAt: new Date(), updatedBy: p.userId })
        .where(and(eq(candidates.id, id), isNull(candidates.deletedAt)))
        .returning({ id: candidates.id });
      if (updated.length === 0) throw new ApiException(ErrorCode.NOT_FOUND);
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "candidate.delete",
        entity: "candidates",
        entityId: id,
        ...meta,
      });
    });
  }
}
