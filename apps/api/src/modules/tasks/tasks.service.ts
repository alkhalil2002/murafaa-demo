import { Injectable } from "@nestjs/common";
import type { OfficePolicy } from "@murafaa/auth";
import { type createTaskBody, ErrorCode } from "@murafaa/contracts";
import { cases, tasks, type Tx, users } from "@murafaa/database";
import type { TaskCategory, TaskColumn, TaskPriority, TaskSource } from "@murafaa/rules";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { containsPattern } from "../../common/db/like.js";
import { ApiException } from "../../common/http/api.exception.js";
import { PolicyService } from "../../common/permissions/policy.service.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { assertOfficeUser, type Meta } from "../cases/case-access.service.js";
import { caseVisibility } from "../cases/case-scope.js";

export type AutoTask = {
  caseId: string;
  autoSignature: string;
  title: string;
  assigneeId: string | null;
  priority: TaskPriority;
  category: TaskCategory;
  dueAt: Date | null;
  origin: TaskSource;
};

/**
 * Tasks (legacy server/tasks.ts), module TASKS. Tasks linked to a case the
 * caller can't see are hidden. System tasks are created at most once per
 * signature (unique office + auto_signature).
 */
@Injectable()
export class TasksService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly policies: PolicyService,
  ) {}

  /** Idempotent system task, inside the caller's transaction (docs BR-TASK-3). */
  async createAuto(tx: Tx, officeId: string, actorId: string, t: AutoTask): Promise<void> {
    await tx
      .insert(tasks)
      .values({ officeId, ...t, status: "NEW", createdBy: actorId })
      .onConflictDoNothing({ target: [tasks.officeId, tasks.autoSignature] });
  }

  async list(p: Principal) {
    const policy = await this.policies.forOffice(p.officeId);
    return this.tenantDb.run(async (tx) => {
      const visibleCases = tx
        .select({ id: cases.id })
        .from(cases)
        .where(caseVisibility(tx, policy, p));
      const rows = await tx
        .select({
          id: tasks.id,
          title: tasks.title,
          assigneeId: tasks.assigneeId,
          assigneeName: users.name,
          priority: tasks.priority,
          dueAt: tasks.dueAt,
          category: tasks.category,
          status: tasks.status,
          origin: tasks.origin,
          caseId: tasks.caseId,
          caseTitle: cases.title,
          createdAt: tasks.createdAt,
        })
        .from(tasks)
        .leftJoin(users, eq(users.id, tasks.assigneeId))
        .leftJoin(cases, eq(cases.id, tasks.caseId))
        .where(
          and(
            isNull(tasks.deletedAt),
            or(isNull(tasks.caseId), inArray(tasks.caseId, visibleCases)),
          ),
        )
        .orderBy(asc(tasks.status), asc(tasks.position), asc(tasks.createdAt));
      return rows.map(({ createdAt: _, ...r }) => ({
        ...r,
        dueAt: r.dueAt?.toISOString() ?? null,
      }));
    });
  }

  async create(p: Principal, input: z.infer<typeof createTaskBody>, meta: Meta) {
    const policy = await this.policies.forOffice(p.officeId);
    return this.tenantDb.run(async (tx) => {
      await assertOfficeUser(tx, input.assigneeId, "assigneeId");
      if (input.caseId) {
        const [c] = await tx
          .select({ id: cases.id })
          .from(cases)
          .where(and(eq(cases.id, input.caseId), caseVisibility(tx, policy, p)));
        if (!c)
          throw new ApiException(ErrorCode.VALIDATION_FAILED, [
            { path: "caseId", message: "errors.NOT_FOUND" },
          ]);
      }
      const [created] = await tx
        .insert(tasks)
        .values({
          officeId: p.officeId,
          ...input,
          assigneeId: input.assigneeId ?? null,
          caseId: input.caseId ?? null,
          status: "NEW",
          origin: "MANUAL",
          createdBy: p.userId,
        })
        .returning({ id: tasks.id });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "task.create",
        entity: "tasks",
        entityId: created!.id,
        ...meta,
      });
      return { id: created!.id };
    });
  }

  /** Move between board columns; DONE stamps the completion time. */
  async move(p: Principal, id: string, status: TaskColumn, meta: Meta) {
    await this.visibleTask(p, id, async (tx) => {
      await tx
        .update(tasks)
        .set({ status, completedAt: status === "DONE" ? sql`now()` : null, updatedBy: p.userId })
        .where(eq(tasks.id, id));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "task.move",
        entity: "tasks",
        entityId: id,
        after: { to: status },
        ...meta,
      });
    });
  }

  async remove(p: Principal, id: string, meta: Meta) {
    await this.visibleTask(p, id, async (tx) => {
      await tx
        .update(tasks)
        .set({ deletedAt: new Date(), updatedBy: p.userId })
        .where(eq(tasks.id, id));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "task.delete",
        entity: "tasks",
        entityId: id,
        ...meta,
      });
    });
  }

  /** A task the caller may act on: not deleted, and its case (if any) is in scope. */
  private async visibleTask(p: Principal, id: string, fn: (tx: Tx) => Promise<void>) {
    const policy = await this.policies.forOffice(p.officeId);
    await this.tenantDb.run(async (tx) => {
      const visibleCases = tx
        .select({ id: cases.id })
        .from(cases)
        .where(caseVisibility(tx, policy, p));
      const [task] = await tx
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.id, id),
            isNull(tasks.deletedAt),
            or(isNull(tasks.caseId), inArray(tasks.caseId, visibleCases)),
          ),
        );
      if (!task) throw new ApiException(ErrorCode.NOT_FOUND);
      await fn(tx);
    });
  }

  // ── Read models for the office overview ──

  /** Open (NEW / IN_PROGRESS) tasks across the office (legacy dashboard count). */
  async openCount(tx: Tx) {
    const [r] = await tx
      .select({ n: count() })
      .from(tasks)
      .where(and(isNull(tasks.deletedAt), inArray(tasks.status, ["NEW", "IN_PROGRESS"])));
    return r?.n ?? 0;
  }

  /** NEW tasks assigned to the caller, newest first (the notification feed). */
  async newAssignedTo(p: Principal) {
    const policy = await this.policies.forOffice(p.officeId);
    return this.tenantDb.run((tx) => {
      const visibleCases = tx
        .select({ id: cases.id })
        .from(cases)
        .where(caseVisibility(tx, policy, p));
      return tx
        .select({ id: tasks.id, title: tasks.title, createdAt: tasks.createdAt })
        .from(tasks)
        .where(
          and(
            isNull(tasks.deletedAt),
            eq(tasks.assigneeId, p.userId),
            eq(tasks.status, "NEW"),
            or(isNull(tasks.caseId), inArray(tasks.caseId, visibleCases)),
          ),
        )
        .orderBy(desc(tasks.createdAt));
    });
  }

  /** Title contains `q`; tasks of out-of-scope cases stay hidden. */
  search(tx: Tx, policy: OfficePolicy, p: Principal, q: string, take: number) {
    const visibleCases = tx
      .select({ id: cases.id })
      .from(cases)
      .where(caseVisibility(tx, policy, p));
    return tx
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(
        and(
          isNull(tasks.deletedAt),
          ilike(tasks.title, containsPattern(q)),
          or(isNull(tasks.caseId), inArray(tasks.caseId, visibleCases)),
        ),
      )
      .limit(take);
  }
}
