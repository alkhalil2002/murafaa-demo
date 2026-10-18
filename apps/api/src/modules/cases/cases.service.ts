import { Injectable } from "@nestjs/common";
import type { OfficePolicy } from "@murafaa/auth";
import { type createCaseBody, ErrorCode, type updateCaseBody } from "@murafaa/contracts";
import type { z } from "zod";
import {
  caseAssignees,
  caseEvents,
  caseReminders,
  cases,
  clients,
  conflictFlags,
  hearings,
  procedureRequests,
  tasks,
  type Tx,
  users,
} from "@murafaa/database";
import {
  type CaseOutcome,
  clampSatisfaction,
  effectiveStage,
  winRate,
  type ClosingChecklistKey,
  nextProcStage,
  prevProcStage,
} from "@murafaa/rules";
import {
  and,
  asc,
  avg,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  notExists,
  or,
} from "drizzle-orm";
import { writeAudit } from "../../common/audit/audit.js";
import { containsPattern } from "../../common/db/like.js";
import { ApiException } from "../../common/http/api.exception.js";
import { PolicyService } from "../../common/permissions/policy.service.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { CaseAccess, type CaseRow, type Meta } from "./case-access.service.js";
import { logCaseEvent } from "./case-events.js";
import { caseVisibility } from "./case-scope.js";
import { ConflictsService } from "./conflicts.service.js";

export type { Meta };

/**
 * Cases (legacy server/cases.ts). Module CASES is checked by the guard;
 * every query here also applies the row scope (layer 3), so a case outside
 * the caller's scope is "not found". Mutations write a timeline event and an
 * audit row, and re-run conflict detection when the client or opponent
 * changes — all in one transaction.
 */
@Injectable()
export class CasesService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly policies: PolicyService,
    private readonly conflicts: ConflictsService,
    private readonly access: CaseAccess,
  ) {}

  private withCase<T>(
    p: Principal,
    caseId: string,
    meta: Meta,
    fn: (tx: Tx, c: CaseRow) => Promise<T>,
  ) {
    return this.access.withCase(p, caseId, meta, fn);
  }

  async list(p: Principal) {
    const policy = await this.policies.forOffice(p.officeId);
    return this.tenantDb.run((tx) =>
      tx
        .select({
          id: cases.id,
          number: cases.number,
          title: cases.title,
          clientName: clients.name,
          opposingParty: cases.opposingParty,
          city: cases.city,
          najizMainClass: cases.najizMainClass,
          stage: cases.stage,
          status: cases.status,
          conflictSeverity: cases.conflictSeverity,
        })
        .from(cases)
        .leftJoin(clients, eq(clients.id, cases.clientId))
        .where(caseVisibility(tx, policy, p))
        .orderBy(desc(cases.createdAt)),
    );
  }

  /** Live case count per client (all of the office's cases, for the clients list). */
  async activeCaseCountsByClient(tx: Tx): Promise<Map<string, number>> {
    const rows = await tx
      .select({ clientId: cases.clientId, n: count() })
      .from(cases)
      .where(and(isNull(cases.deletedAt), isNotNull(cases.clientId)))
      .groupBy(cases.clientId);
    return new Map(rows.map((r) => [r.clientId!, r.n]));
  }

  /** Held hearings (newest first) and the single upcoming one, each with its follow-up reminders and tasks. */
  private async hearingsOf(tx: Tx, caseId: string) {
    const rows = await tx
      .select()
      .from(hearings)
      .where(and(eq(hearings.caseId, caseId), isNull(hearings.deletedAt)))
      .orderBy(desc(hearings.hearingDate));
    const ids = rows.map((h) => h.id);
    const reminders = ids.length
      ? await tx
          .select()
          .from(caseReminders)
          .where(and(inArray(caseReminders.hearingId, ids), isNull(caseReminders.deletedAt)))
          .orderBy(asc(caseReminders.dueOn))
      : [];
    const hearingTasks = ids.length
      ? await tx
          .select({
            id: tasks.id,
            hearingId: tasks.hearingId,
            title: tasks.title,
            assigneeId: tasks.assigneeId,
            assigneeName: users.name,
            dueAt: tasks.dueAt,
            status: tasks.status,
          })
          .from(tasks)
          .leftJoin(users, eq(users.id, tasks.assigneeId))
          .where(and(inArray(tasks.hearingId, ids), isNull(tasks.deletedAt)))
          .orderBy(asc(tasks.createdAt))
      : [];
    const shaped = rows.map((h) => ({
      id: h.id,
      sequenceNo: h.sequenceNo,
      hearingDate: h.hearingDate.toISOString(),
      status: h.status,
      stageIndex: h.stageIndex,
      kind: h.kind,
      minutes: h.minutes,
      result: h.result,
      clientReport: h.clientReport,
      reportApprovalRequested: h.reportApprovalRequested,
      reportApproved: h.reportApproved,
      reportSentToClient: h.reportSentToClient,
      isPending: h.isPending,
      pendingItems: h.pendingItems ?? [],
      reminderRecurDays: h.reminderRecurDays,
      actions: {
        reminders: reminders
          .filter((r) => r.hearingId === h.id)
          .map((r) => ({
            id: r.id,
            text: r.text,
            dueOn: r.dueOn.toISOString(),
            isTaskLinked: r.isTaskLinked,
          })),
        tasks: hearingTasks
          .filter((tk) => tk.hearingId === h.id)
          .map((tk) => ({
            id: tk.id,
            title: tk.title,
            assigneeId: tk.assigneeId,
            assigneeName: tk.assigneeName,
            dueAt: tk.dueAt?.toISOString() ?? null,
            done: tk.status === "DONE",
          })),
      },
    }));
    return {
      held: shaped.filter((h) => h.status === "HELD"),
      upcoming: shaped.find((h) => h.status === "UPCOMING"),
    };
  }

  /** Procedural requests by stage order, each with its own timeline entries. */
  private async requestsOf(tx: Tx, caseId: string) {
    const rows = await tx
      .select()
      .from(procedureRequests)
      .where(and(eq(procedureRequests.caseId, caseId), isNull(procedureRequests.deletedAt)))
      .orderBy(asc(procedureRequests.stageIndex), asc(procedureRequests.createdAt));
    const ids = rows.map((r) => r.id);
    const logs = ids.length
      ? await tx
          .select()
          .from(caseEvents)
          .where(inArray(caseEvents.procedureRequestId, ids))
          .orderBy(desc(caseEvents.occurredAt))
      : [];
    return rows.map((r) => ({
      id: r.id,
      hearingId: r.hearingId,
      stageIndex: r.stageIndex,
      party: r.party,
      type: r.type,
      text: r.text,
      status: r.status,
      log: logs
        .filter((e) => e.procedureRequestId === r.id)
        .map((e) => ({
          id: e.id,
          message: e.messageKey ? { messageKey: e.messageKey, params: e.params ?? {} } : null,
          text: e.text,
          occurredAt: e.occurredAt.toISOString(),
        })),
    }));
  }

  /** Active office staff for the assignee picker. */
  assignableUsers() {
    return this.tenantDb.run((tx) =>
      tx
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(and(eq(users.isActive, true), isNull(users.deletedAt)))
        .orderBy(asc(users.name)),
    );
  }

  async detail(p: Principal, caseId: string, meta: Meta) {
    const policy = await this.policies.forOffice(p.officeId);
    return this.withCase(p, caseId, meta, async (tx, c) => {
      const [client] = c.clientId
        ? await tx
            .select({ id: clients.id, name: clients.name, phone: clients.phone })
            .from(clients)
            .where(eq(clients.id, c.clientId))
        : [];
      const assignees = await tx
        .select({ userId: caseAssignees.userId, name: users.name })
        .from(caseAssignees)
        .innerJoin(users, eq(users.id, caseAssignees.userId))
        .where(eq(caseAssignees.caseId, caseId))
        .orderBy(asc(users.name));
      const flags = await tx.select().from(conflictFlags).where(eq(conflictFlags.caseId, caseId));
      const events = await tx
        .select({
          id: caseEvents.id,
          type: caseEvents.type,
          messageKey: caseEvents.messageKey,
          params: caseEvents.params,
          text: caseEvents.text,
          actorName: users.name,
          occurredAt: caseEvents.occurredAt,
        })
        .from(caseEvents)
        .leftJoin(users, eq(users.id, caseEvents.actorUserId))
        .where(eq(caseEvents.caseId, caseId))
        .orderBy(desc(caseEvents.occurredAt))
        .limit(200);
      const { held, upcoming } = await this.hearingsOf(tx, caseId);
      const requests = await this.requestsOf(tx, caseId);

      return {
        id: c.id,
        number: c.number,
        title: c.title,
        clientRole: c.clientRole,
        client: client ?? null,
        opposingParty: c.opposingParty,
        entity: c.entity,
        najizMainClass: c.najizMainClass,
        najizSubClass: c.najizSubClass,
        najizCaseType: c.najizCaseType,
        city: c.city,
        stage: c.stage,
        effectiveStage: effectiveStage(
          c.stage,
          held.map((h) => ({
            status: h.status,
            stageIndex: h.stageIndex,
            hearingDate: new Date(h.hearingDate),
          })),
        ),
        status: c.status,
        outcome: c.outcome,
        judgmentDate: c.judgmentDate?.toISOString() ?? null,
        objectionDueAt: c.objectionDueAt?.toISOString() ?? null,
        procEnded: c.procEnded,
        procResult: c.procResult,
        closingChecklist: c.closingChecklist ?? {},
        clientSatisfactionScore: c.clientSatisfactionScore,
        referralRequested: c.referralRequested,
        isArchived: c.isArchived,
        assignees,
        upcomingHearing: upcoming ?? null,
        hearings: held,
        procedureRequests: requests,
        conflicts: await this.conflicts.render(
          tx,
          policy,
          p,
          flags.filter((f) => f.status !== "RESOLVED"),
        ),
        events: events.map((e) => ({
          id: e.id,
          type: e.type,
          message: e.messageKey ? { messageKey: e.messageKey, params: e.params ?? {} } : null,
          text: e.text,
          actorName: e.actorName,
          occurredAt: e.occurredAt.toISOString(),
        })),
      };
    });
  }

  /** The client and every assignee must belong to this office (RLS guarantees it: other offices' rows are invisible). */
  private async assertParticipants(tx: Tx, clientId: string | null | undefined, userIds: string[]) {
    if (clientId) {
      const [owned] = await tx
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)));
      if (!owned)
        throw new ApiException(ErrorCode.VALIDATION_FAILED, [
          { path: "clientId", message: "errors.NOT_FOUND" },
        ]);
    }
    if (userIds.length) {
      const found = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(inArray(users.id, userIds), isNull(users.deletedAt)));
      if (found.length !== userIds.length) {
        throw new ApiException(ErrorCode.VALIDATION_FAILED, [
          { path: "assigneeIds", message: "errors.NOT_FOUND" },
        ]);
      }
    }
  }

  /** Create a case; the creator is always assigned so an ASSIGNED-scope creator can see it. */
  create(p: Principal, input: z.infer<typeof createCaseBody>, meta: Meta) {
    const assigneeIds = [...new Set([...input.assigneeIds, p.userId])];
    return this.tenantDb.run((tx) => this.insertCase(tx, p, input, assigneeIds, meta));
  }

  /** Shared by create and lead conversion; runs in the caller's transaction. */
  async insertCase(
    tx: Tx,
    p: Principal,
    input: Omit<z.infer<typeof createCaseBody>, "assigneeIds">,
    assigneeIds: string[],
    meta: Meta,
    opening: { messageKey: string; params?: Record<string, string> } = {
      messageKey: "event.caseCreated",
    },
  ) {
    await this.assertParticipants(tx, input.clientId, assigneeIds);
    const [created] = await tx
      .insert(cases)
      .values({
        officeId: p.officeId,
        ...input,
        clientId: input.clientId ?? null,
        createdBy: p.userId,
      })
      .returning({ id: cases.id });
    const caseId = created!.id;
    await tx.insert(caseAssignees).values(
      assigneeIds.map((userId) => ({
        officeId: p.officeId,
        caseId,
        userId,
        createdBy: p.userId,
      })),
    );
    await logCaseEvent(tx, {
      officeId: p.officeId,
      caseId,
      type: "SYSTEM",
      actorUserId: p.userId,
      ...opening,
    });
    await this.conflicts.recompute(tx, p.officeId, caseId, p.userId);
    await this.rescanParties(tx, p, input.opposingParty, input.clientId);
    await writeAudit(tx, {
      officeId: p.officeId,
      actorId: p.userId,
      action: "case.create",
      entity: "cases",
      entityId: caseId,
      ...meta,
    });
    return { id: caseId };
  }

  /**
   * Other cases can gain or lose a conflict because of this case's parties
   * (rules 3 and 4 look across cases), so re-scan by the opponent's and the
   * client's names. Legacy only re-checked the case being saved.
   */
  private async rescanParties(
    tx: Tx,
    p: Principal,
    opponent: string | null | undefined,
    clientId: string | null | undefined,
  ) {
    await this.conflicts.rescanForName(tx, p.officeId, opponent, p.userId);
    if (clientId) {
      const [client] = await tx
        .select({ name: clients.name })
        .from(clients)
        .where(eq(clients.id, clientId));
      await this.conflicts.rescanForName(tx, p.officeId, client?.name, p.userId);
    }
  }

  async update(p: Principal, caseId: string, input: z.infer<typeof updateCaseBody>, meta: Meta) {
    await this.withCase(p, caseId, meta, async (tx, before) => {
      if (input.clientId !== undefined) await this.assertParticipants(tx, input.clientId, []);
      const [oldClient] = before.clientId
        ? await tx
            .select({ name: clients.name })
            .from(clients)
            .where(eq(clients.id, before.clientId))
        : [];
      await tx
        .update(cases)
        .set({ ...input, updatedBy: p.userId })
        .where(eq(cases.id, caseId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "SYSTEM",
        actorUserId: p.userId,
        messageKey: "event.caseUpdated",
      });

      const partiesChanged =
        (input.opposingParty !== undefined && input.opposingParty !== before.opposingParty) ||
        (input.clientId !== undefined && input.clientId !== before.clientId);
      if (partiesChanged) {
        await this.conflicts.recompute(tx, p.officeId, caseId, p.userId);
        const after = { ...before, ...input };
        await this.rescanParties(tx, p, after.opposingParty, after.clientId);
        // Cases that matched the OLD names may no longer (or newly) conflict.
        await this.conflicts.rescanForName(tx, p.officeId, before.opposingParty, p.userId);
        await this.conflicts.rescanForName(tx, p.officeId, oldClient?.name, p.userId);
      }
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "case.update",
        entity: "cases",
        entityId: caseId,
        ...meta,
      });
    });
  }

  async setOutcome(p: Principal, caseId: string, outcome: CaseOutcome | null, meta: Meta) {
    await this.withCase(p, caseId, meta, async (tx) => {
      await tx.update(cases).set({ outcome, updatedBy: p.userId }).where(eq(cases.id, caseId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "SYSTEM",
        actorUserId: p.userId,
        messageKey: "event.outcomeSet",
        params: { outcome: outcome ? `@case.outcome.${outcome}` : "@common.none" },
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "case.setOutcome",
        entity: "cases",
        entityId: caseId,
        after: { outcome: outcome ?? "—" },
        ...meta,
      });
    });
  }

  async assign(p: Principal, caseId: string, userId: string, meta: Meta) {
    await this.withCase(p, caseId, meta, async (tx) => {
      const [user] = await tx
        .select({ name: users.name })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)));
      if (!user) throw new ApiException(ErrorCode.NOT_FOUND);
      const added = await tx
        .insert(caseAssignees)
        .values({ officeId: p.officeId, caseId, userId, createdBy: p.userId })
        .onConflictDoNothing()
        .returning({ id: caseAssignees.id });
      if (!added.length) return;
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "SYSTEM",
        actorUserId: p.userId,
        messageKey: "event.assigneeAdded",
        params: { name: user.name },
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "case.assign",
        entity: "cases",
        entityId: caseId,
        after: { userId },
        ...meta,
      });
    });
  }

  /** Remove an assignee; the name in the timeline comes from the database, not the request. */
  async unassign(p: Principal, caseId: string, userId: string, meta: Meta) {
    await this.withCase(p, caseId, meta, async (tx) => {
      const removed = await tx
        .delete(caseAssignees)
        .where(and(eq(caseAssignees.caseId, caseId), eq(caseAssignees.userId, userId)))
        .returning({ id: caseAssignees.id });
      if (!removed.length) return;
      const [user] = await tx.select({ name: users.name }).from(users).where(eq(users.id, userId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "SYSTEM",
        actorUserId: p.userId,
        messageKey: "event.assigneeRemoved",
        params: { name: user?.name ?? "—" },
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "case.unassign",
        entity: "cases",
        entityId: caseId,
        after: { userId },
        ...meta,
      });
    });
  }

  /**
   * Manual stage move. Never touches the objection deadline: that comes only
   * from a recorded judgment (docs/06 §1), not from a stage bump.
   */
  async moveStage(p: Principal, caseId: string, direction: 1 | -1, meta: Meta) {
    await this.withCase(p, caseId, meta, async (tx, c) => {
      const next = direction === 1 ? nextProcStage(c.stage) : prevProcStage(c.stage);
      if (!next) return;
      await tx.update(cases).set({ stage: next, updatedBy: p.userId }).where(eq(cases.id, caseId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "SYSTEM",
        actorUserId: p.userId,
        messageKey: direction === 1 ? "event.stagePromoted" : "event.stageRemanded",
        params: { stage: `@case.stage.${next}` },
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: direction === 1 ? "case.stagePromote" : "case.stageRemand",
        entity: "cases",
        entityId: caseId,
        after: { to: next },
        ...meta,
      });
    });
  }

  async setProcedureEnded(
    p: Principal,
    caseId: string,
    ended: boolean,
    result: string | null,
    meta: Meta,
  ) {
    await this.withCase(p, caseId, meta, async (tx) => {
      await tx
        .update(cases)
        .set({ procEnded: ended, procResult: ended ? result : null, updatedBy: p.userId })
        .where(eq(cases.id, caseId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "SYSTEM",
        actorUserId: p.userId,
        ...(ended
          ? { messageKey: "event.procEnded", params: { result: result || "—" } }
          : { messageKey: "event.procReopened" }),
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: ended ? "case.procEnd" : "case.procReopen",
        entity: "cases",
        entityId: caseId,
        ...meta,
      });
    });
  }

  async toggleChecklist(p: Principal, caseId: string, key: ClosingChecklistKey, meta: Meta) {
    await this.withCase(p, caseId, meta, async (tx, c) => {
      const checklist = { ...(c.closingChecklist ?? {}), [key]: !c.closingChecklist?.[key] };
      await tx
        .update(cases)
        .set({ closingChecklist: checklist, updatedBy: p.userId })
        .where(eq(cases.id, caseId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "case.closingChecklist",
        entity: "cases",
        entityId: caseId,
        after: { key },
        ...meta,
      });
    });
  }

  async setSatisfaction(p: Principal, caseId: string, score: number, meta: Meta) {
    await this.withCase(p, caseId, meta, async (tx) => {
      const clamped = clampSatisfaction(score);
      await tx
        .update(cases)
        .set({ clientSatisfactionScore: clamped, updatedBy: p.userId })
        .where(eq(cases.id, caseId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "case.csat",
        entity: "cases",
        entityId: caseId,
        after: { score: clamped },
        ...meta,
      });
    });
  }

  async requestReferral(p: Principal, caseId: string, meta: Meta) {
    await this.withCase(p, caseId, meta, async (tx) => {
      await tx
        .update(cases)
        .set({ referralRequested: true, updatedBy: p.userId })
        .where(eq(cases.id, caseId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "SYSTEM",
        actorUserId: p.userId,
        messageKey: "event.referralRequested",
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "case.referral",
        entity: "cases",
        entityId: caseId,
        ...meta,
      });
    });
  }

  /** Business archive (5-year retention), distinct from soft delete: also closes the case. */
  async archive(p: Principal, caseId: string, meta: Meta) {
    await this.withCase(p, caseId, meta, async (tx) => {
      await tx
        .update(cases)
        .set({ isArchived: true, status: "CLOSED", updatedBy: p.userId })
        .where(eq(cases.id, caseId));
      await logCaseEvent(tx, {
        officeId: p.officeId,
        caseId,
        type: "SYSTEM",
        actorUserId: p.userId,
        messageKey: "event.caseArchived",
      });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "case.archive",
        entity: "cases",
        entityId: caseId,
        ...meta,
      });
    });
  }

  /** Partner-only documented consent to proceed despite a conflict (docs/06 §4). */
  async waiveConflict(p: Principal, caseId: string, flagId: string, note: string, meta: Meta) {
    await this.withCase(p, caseId, meta, async (tx) => {
      const updated = await tx
        .update(conflictFlags)
        .set({
          status: "WAIVED",
          waiverNote: note,
          waivedBy: p.userId,
          waivedAt: new Date(),
          updatedBy: p.userId,
        })
        .where(
          and(
            eq(conflictFlags.id, flagId),
            eq(conflictFlags.caseId, caseId),
            eq(conflictFlags.status, "ACTIVE"),
          ),
        )
        .returning({ type: conflictFlags.conflictType });
      if (!updated.length) throw new ApiException(ErrorCode.NOT_FOUND);
      await this.conflicts.refreshSeverity(tx, caseId);
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "conflict.waived",
        entity: "cases",
        entityId: caseId,
        after: { type: updated[0]!.type },
        ...meta,
      });
    });
  }

  // ── Read models for the office overview (today, dashboard, journey, alerts, search) ──

  /** Office-wide case aggregates (legacy dashboard/journey count every case, not the caller's scope). */
  async stats(tx: Tx) {
    const live = isNull(cases.deletedAt);
    const [active] = await tx
      .select({ n: count() })
      .from(cases)
      .where(and(live, eq(cases.status, "ACTIVE")));
    const [archived] = await tx
      .select({ n: count() })
      .from(cases)
      .where(and(live, eq(cases.isArchived, true)));
    const [csat] = await tx
      .select({ v: avg(cases.clientSatisfactionScore) })
      .from(cases)
      .where(and(live, isNotNull(cases.clientSatisfactionScore)));
    const outcomes = await tx
      .select({ outcome: cases.outcome, n: count() })
      .from(cases)
      .where(and(live, isNotNull(cases.outcome)))
      .groupBy(cases.outcome);
    const byClass = await tx
      .select({ label: cases.najizMainClass, n: count() })
      .from(cases)
      .where(and(live, isNotNull(cases.najizMainClass)))
      .groupBy(cases.najizMainClass);
    return {
      activeCases: active?.n ?? 0,
      archivedCases: archived?.n ?? 0,
      avgSatisfaction: csat?.v == null ? null : Number(csat.v),
      winRatePct: winRate(Object.fromEntries(outcomes.map((o) => [o.outcome!, o.n]))),
      byClassification: byClass
        .map((r) => ({ label: r.label!, count: r.n }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /**
   * Alert sources inside the caller's row scope: cases with an active
   * conflict, and active cases with no hearing yet. Legacy listed these for
   * every case in the office, naming cases the caller may not see.
   */
  async alertCandidates(tx: Tx, policy: OfficePolicy, p: Principal) {
    const visible = caseVisibility(tx, policy, p);
    const conflicted = await tx
      .select({ id: cases.id, title: cases.title, severity: cases.conflictSeverity })
      .from(cases)
      .where(and(visible, isNotNull(cases.conflictSeverity)));
    const empty = await tx
      .select({ id: cases.id, title: cases.title })
      .from(cases)
      .where(
        and(
          visible,
          eq(cases.status, "ACTIVE"),
          notExists(
            tx
              .select({ one: hearings.id })
              .from(hearings)
              .where(and(eq(hearings.caseId, cases.id), isNull(hearings.deletedAt))),
          ),
        ),
      );
    return { conflicted, empty };
  }

  /** Title or number contains `q`, within the caller's row scope. */
  search(tx: Tx, policy: OfficePolicy, p: Principal, q: string, take: number) {
    const pat = containsPattern(q);
    return tx
      .select({ id: cases.id, title: cases.title, number: cases.number })
      .from(cases)
      .where(
        and(caseVisibility(tx, policy, p), or(ilike(cases.title, pat), ilike(cases.number, pat))),
      )
      .orderBy(desc(cases.createdAt))
      .limit(take);
  }
}
