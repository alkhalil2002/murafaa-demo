import { Injectable } from "@nestjs/common";
import { ErrorCode } from "@murafaa/contracts";
import { officePerformanceWeights, performanceEvents, type Tx, users } from "@murafaa/database";
import {
  completionRatePct,
  PERFORMANCE_EVENT_KINDS,
  PERFORMANCE_POINTS,
  type PerformanceEventKind,
  type PulseWindow,
  pulseSince,
} from "@murafaa/rules";
import { and, desc, eq, gte, isNull, sql, sum } from "drizzle-orm";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import type { Meta } from "../cases/case-access.service.js";
import { TasksService } from "../tasks/tasks.service.js";

const eventOut = (e: {
  id: string;
  kind: PerformanceEventKind;
  points: number;
  occurredAt: Date;
}) => ({
  id: e.id,
  kind: e.kind,
  points: e.points,
  occurredAt: e.occurredAt.toISOString(),
});

/**
 * نبض الفريق (legacy server/pulse.ts): rankings from real earned points only,
 * windows in Riyadh time. Everyone sees their own card; the team view needs
 * PULSE view; the weights need its full level.
 */
@Injectable()
export class PulseService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly tasks: TasksService,
  ) {}

  private ranking(tx: Tx, since: Date) {
    const points = sum(performanceEvents.points).mapWith(Number);
    return tx
      .select({ userId: users.id, name: users.name, role: users.role, points })
      .from(performanceEvents)
      .innerJoin(users, eq(users.id, performanceEvents.userId))
      .where(gte(performanceEvents.occurredAt, since))
      .groupBy(users.id)
      .orderBy(desc(points), users.name);
  }

  /** The week's leader for the Today card, or null. */
  async employeeOfWeek(tx: Tx) {
    const [top] = await this.ranking(tx, pulseSince("week")).limit(1);
    return top ? { name: top.name, role: top.role, points: top.points } : null;
  }

  self(p: Principal, window: PulseWindow) {
    return this.tenantDb.run(async (tx) => {
      const events = await tx
        .select()
        .from(performanceEvents)
        .where(
          and(
            eq(performanceEvents.userId, p.userId),
            gte(performanceEvents.occurredAt, pulseSince(window)),
          ),
        )
        .orderBy(desc(performanceEvents.occurredAt));
      const { assigned, done } = await this.tasks.assigneeCounts(tx, p.userId);
      return {
        points: events.reduce((s, e) => s + e.points, 0),
        tasksDone: done,
        completionRatePct: completionRatePct(done, assigned),
        events: events.slice(0, 20).map(eventOut),
      };
    });
  }

  team(window: PulseWindow) {
    return this.tenantDb.run(async (tx) => {
      const since = pulseSince(window);
      const ranking = await this.ranking(tx, since);
      const byKind = await tx
        .select({ kind: performanceEvents.kind, n: sql<number>`count(*)`.mapWith(Number) })
        .from(performanceEvents)
        .where(gte(performanceEvents.occurredAt, since))
        .groupBy(performanceEvents.kind);
      const n = (k: PerformanceEventKind) => byKind.find((r) => r.kind === k)?.n ?? 0;
      return {
        totals: {
          totalPoints: ranking.reduce((s, r) => s + r.points, 0),
          tasksCompleted: n("TASK_COMPLETED"),
          hearingsLogged: n("HEARING_RECORDED"),
        },
        ranking,
      };
    });
  }

  drill(userId: string, window: PulseWindow) {
    return this.tenantDb.run(async (tx) => {
      const [u] = await tx.select({ name: users.name }).from(users).where(eq(users.id, userId));
      if (!u) throw new ApiException(ErrorCode.NOT_FOUND);
      const events = await tx
        .select()
        .from(performanceEvents)
        .where(
          and(
            eq(performanceEvents.userId, userId),
            gte(performanceEvents.occurredAt, pulseSince(window)),
          ),
        )
        .orderBy(desc(performanceEvents.occurredAt));
      return { userId, name: u.name, events: events.map(eventOut) };
    });
  }

  weights() {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({ kind: officePerformanceWeights.kind, points: officePerformanceWeights.points })
        .from(officePerformanceWeights)
        .where(isNull(officePerformanceWeights.deletedAt));
      return PERFORMANCE_EVENT_KINDS.map((kind) => {
        const o = rows.find((r) => r.kind === kind);
        return { kind, points: o?.points ?? PERFORMANCE_POINTS[kind], isDefault: !o };
      });
    });
  }

  /** New points apply to actions from now on; earned points keep their value. */
  setWeight(p: Principal, kind: PerformanceEventKind, points: number, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      await tx
        .insert(officePerformanceWeights)
        .values({ officeId: p.officeId, kind, points, createdBy: p.userId })
        .onConflictDoUpdate({
          target: [officePerformanceWeights.officeId, officePerformanceWeights.kind],
          set: { points, deletedAt: null, updatedBy: p.userId, updatedAt: sql`now()` },
        });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "pulse.setWeight",
        entity: "office_performance_weights",
        entityId: null,
        after: { kind, points },
        ...meta,
      });
    });
  }

  /** Back to the default: the override row is soft-deleted (the app role has no DELETE). */
  resetWeight(p: Principal, kind: PerformanceEventKind, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      await tx
        .update(officePerformanceWeights)
        .set({ deletedAt: new Date(), updatedBy: p.userId })
        .where(
          and(eq(officePerformanceWeights.kind, kind), isNull(officePerformanceWeights.deletedAt)),
        );
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "pulse.resetWeight",
        entity: "office_performance_weights",
        entityId: null,
        after: { kind },
        ...meta,
      });
    });
  }
}
