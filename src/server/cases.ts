import { CaseEventType, CaseOutcome, CaseStatus, HearingStatus, PermModule, ProcStage } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logCaseEvent } from "@/lib/case-events";
import { t } from "@/lib/i18n";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { caseScopeWhere, isCaseVisible } from "@/lib/permissions/scope";
import { recomputeCaseConflicts, rescanConflictsForName } from "@/lib/conflict/service";

/**
 * Cases service (docs/03, docs/06). All access is gated server-side by the
 * القضايا module (layer 1) and case row-scope (layer 3). Every mutation writes
 * a timeline event and an audit row, and re-runs conflict detection when the
 * client or opponent changes.
 */

const createSchema = z.object({
  number: z.string().min(1),
  title: z.string().min(1),
  clientRole: z.enum(["PLAINTIFF", "DEFENDANT"]).optional(),
  /**
   * Required (docs/06 §case-client). A case is work done FOR someone: without
   * the link there is nobody to bill, no conflict check to run, and no client
   * portal entry — the case exists but half the product does not apply to it.
   *
   * `entity` is NOT a substitute. It is free text for the organisation on our
   * side and carries no relation, so it cannot drive any of the above.
   *
   * The column itself is still nullable, because rows created before this rule
   * exist. See the note on updateSchema.
   */
  clientId: z.string().uuid({ message: "CLIENT_REQUIRED" }),
  opposingParty: z.string().trim().nullish(),
  entity: z.string().trim().nullish(),
  najizMainClass: z.string().nullish(),
  najizSubClass: z.string().nullish(),
  najizCaseType: z.string().nullish(),
  city: z.string().nullish(),
  stage: z.nativeEnum(ProcStage).optional(),
  status: z.nativeEnum(CaseStatus).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
});
export type CreateCaseInput = z.infer<typeof createSchema>;

/**
 * Update allows omitting clientId (leave it as it is) but never clearing it.
 *
 * `.partial()` alone would make the field optional, which is right, but the
 * type must still forbid null — otherwise a case created under the rule could
 * be unlinked afterwards through the edit form, and the rule would hold only
 * for the first five seconds of a case's life.
 *
 * Cases that predate the rule keep their null and stay editable; requiring a
 * client on every update would make them impossible to touch at all, which
 * punishes the user for our schema history. They are reported by
 * `countCasesWithoutClient` so they can be fixed deliberately.
 */
const updateSchema = createSchema.partial().extend({
  clientId: z.string().uuid().optional(),
});
export type UpdateCaseInput = z.infer<typeof updateSchema>;

/** How many cases predate the client-required rule. Surfaced in settings. */
export async function countCasesWithoutClient(officeId: string): Promise<number> {
  return prisma.case.count({ where: { officeId, clientId: null, deletedAt: null } });
}

/** Derived effective stage: the latest HELD hearing's stage, else the baseline. */
const STAGE_BY_INDEX: ProcStage[] = [
  ProcStage.RECONCILIATION,
  ProcStage.FIRST_INSTANCE,
  ProcStage.APPEAL,
  ProcStage.CASSATION,
  ProcStage.EXECUTION,
];

export function effectiveStage(
  baseline: ProcStage,
  hearings: readonly { status: HearingStatus; stageIndex: number | null; hearingDate: Date }[],
): ProcStage {
  const held = hearings
    .filter((h) => h.status === HearingStatus.HELD && h.stageIndex != null)
    .sort((a, b) => b.hearingDate.getTime() - a.hearingDate.getTime());
  const latest = held[0];
  if (latest && latest.stageIndex != null) {
    return STAGE_BY_INDEX[latest.stageIndex] ?? baseline;
  }
  return baseline;
}

export async function listCases(session: AppSession) {
  await requireModule(session, PermModule.CASES, "view");
  const where = await caseScopeWhere(session);
  return prisma.case.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      number: true,
      title: true,
      opposingParty: true,
      city: true,
      najizMainClass: true,
      stage: true,
      status: true,
      conflictSeverity: true,
      client: { select: { id: true, name: true } },
      assignees: { select: { userId: true } },
    },
  });
}

/** Active office staff, for the assignee picker on case creation/editing. */
export async function listAssignableUsers(session: AppSession) {
  await requireModule(session, PermModule.CASES, "view");
  return prisma.user.findMany({
    where: { officeId: session.officeId, isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getCase(session: AppSession, id: string) {
  await requireModule(session, PermModule.CASES, "view");
  const found = await prisma.case.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      assignees: { include: { user: { select: { id: true, name: true } } } },
      hearings: { where: { deletedAt: null }, orderBy: { hearingDate: "asc" } },
      events: { orderBy: { occurredAt: "desc" } },
      conflictFlags: true,
      reminders: { where: { deletedAt: null }, orderBy: { dueOn: "asc" } },
    },
  });
  if (!found) throw new PermissionError("scope");
  const visible = await isCaseVisible(
    session,
    id,
    found.assignees.map((a) => a.userId),
  );
  if (!visible) {
    await logAudit({
      session,
      action: "case.view",
      resource: "cases",
      targetId: id,
      decision: "DENY",
      detail: "out of scope",
    });
    throw new PermissionError("scope");
  }
  return {
    ...found,
    effectiveStage: effectiveStage(found.stage, found.hearings),
  };
}

export async function createCase(session: AppSession, raw: CreateCaseInput) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = createSchema.parse(raw);

  // Always assign the creator (they hold CASES edit — requireModule passed) so
  // an ASSIGNED-scope creator can see the case they just made.
  const ids = new Set(input.assigneeIds ?? []);
  ids.add(session.userId);

  const created = await prisma.$transaction(async (tx) => {
    // Tenancy: the client and every assignee MUST belong to this office. The
    // single-column FKs can't enforce it, so validate here (docs guardrail 3).
    // clientId is required by the schema, so this is unconditional now: the
    // client must exist AND belong to this office. A uuid for another tenant's
    // client is a scope violation, not a validation error.
    const owned = await tx.client.findFirst({
      where: { id: input.clientId, officeId: session.officeId, deletedAt: null },
      select: { id: true },
    });
    if (!owned) throw new PermissionError("scope");
    const assigneeCount = await tx.user.count({
      where: { id: { in: [...ids] }, officeId: session.officeId, deletedAt: null },
    });
    if (assigneeCount !== ids.size) throw new PermissionError("scope");

    const c = await tx.case.create({
      data: {
        officeId: session.officeId,
        createdById: session.userId,
        number: input.number,
        title: input.title,
        clientRole: input.clientRole ?? "PLAINTIFF",
        clientId: input.clientId,
        opposingParty: input.opposingParty ?? null,
        najizMainClass: input.najizMainClass ?? null,
        najizSubClass: input.najizSubClass ?? null,
        najizCaseType: input.najizCaseType ?? null,
        city: input.city ?? null,
        stage: input.stage ?? ProcStage.FIRST_INSTANCE,
      },
    });
    for (const userId of ids) {
      await tx.caseAssignee.create({
        data: { officeId: session.officeId, caseId: c.id, userId },
      });
    }
    await logCaseEvent(tx, {
      officeId: session.officeId,
      caseId: c.id,
      type: CaseEventType.SYSTEM,
      description: t("event.caseCreated"),
      actorUserId: session.userId,
    });
    // Conflict detection runs inside the same transaction.
    await recomputeCaseConflicts(session, c.id, tx);
    return c;
  });

  await logAudit({
    session,
    action: "case.create",
    resource: "cases",
    targetId: created.id,
    detail: created.title,
  });
  return created;
}

export async function updateCase(session: AppSession, id: string, raw: UpdateCaseInput) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = updateSchema.parse(raw);

  const before = await prisma.case.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
    include: { assignees: { select: { userId: true } }, client: { select: { name: true } } },
  });
  if (!before) throw new PermissionError("scope");
  const visible = await isCaseVisible(session, id, before.assignees.map((a) => a.userId));
  if (!visible) throw new PermissionError("scope");

  const conflictInputsChanged =
    ("opposingParty" in input && input.opposingParty !== before.opposingParty) ||
    ("clientId" in input && input.clientId !== before.clientId);

  const updated = await prisma.$transaction(async (tx) => {
    // Tenancy: a re-linked client must belong to this office (docs guardrail 3).
    if (input.clientId) {
      const owned = await tx.client.findFirst({
        where: { id: input.clientId, officeId: session.officeId, deletedAt: null },
        select: { id: true },
      });
      if (!owned) throw new PermissionError("scope");
    }
    const c = await tx.case.update({
      where: { id },
      data: {
        number: input.number,
        title: input.title,
        clientRole: input.clientRole,
        clientId: input.clientId,
        opposingParty: input.opposingParty,
        entity: input.entity,
        najizMainClass: input.najizMainClass,
        najizSubClass: input.najizSubClass,
        najizCaseType: input.najizCaseType,
        city: input.city,
        stage: input.stage,
        status: input.status,
      },
    });
    await logCaseEvent(tx, {
      officeId: session.officeId,
      caseId: id,
      type: CaseEventType.SYSTEM,
      description: t("event.caseUpdated"),
      actorUserId: session.userId,
    });
    if (conflictInputsChanged) {
      await recomputeCaseConflicts(session, id, tx);
      // Re-scan cases that referenced the OLD opponent/client name too.
      if (before.opposingParty) await rescanConflictsForName(session, before.opposingParty, tx);
      if (before.client?.name) await rescanConflictsForName(session, before.client.name, tx);
    }
    return c;
  });

  await logAudit({ session, action: "case.update", resource: "cases", targetId: id });
  return updated;
}

/**
 * Record the case outcome (docs/06 §10 — feeds the win-rate KPI). A closing
 * concept, not a Najiz-classification field, so it's its own small mutation
 * rather than folded into updateCase.
 */
export async function setCaseOutcome(
  session: AppSession,
  id: string,
  outcome: CaseOutcome | null,
) {
  await requireModule(session, PermModule.CASES, "edit");
  const before = await prisma.case.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
    include: { assignees: { select: { userId: true } } },
  });
  if (!before) throw new PermissionError("scope");
  const visible = await isCaseVisible(session, id, before.assignees.map((a) => a.userId));
  if (!visible) throw new PermissionError("scope");

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.case.update({ where: { id }, data: { outcome } });
    await logCaseEvent(tx, {
      officeId: session.officeId,
      caseId: id,
      type: CaseEventType.SYSTEM,
      description: t("event.outcomeSet", { outcome: outcome ? t(`case.outcome.${outcome}`) : t("common.none") }),
      actorUserId: session.userId,
    });
    return c;
  });

  await logAudit({ session, action: "case.setOutcome", resource: "cases", targetId: id, detail: outcome ?? "—" });
  return updated;
}

export async function assignUser(session: AppSession, caseId: string, userId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  const c = await prisma.case.findFirst({
    where: { id: caseId, officeId: session.officeId, deletedAt: null },
    include: { assignees: { select: { userId: true } } },
  });
  if (!c) throw new PermissionError("scope");
  if (!(await isCaseVisible(session, caseId, c.assignees.map((a) => a.userId))))
    throw new PermissionError("scope");
  // Tenancy: only a user in THIS office may be assigned (single-column FK
  // can't enforce it).
  const inOffice = await prisma.user.findFirst({
    where: { id: userId, officeId: session.officeId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!inOffice) throw new PermissionError("scope");

  await prisma.caseAssignee.upsert({
    where: { caseId_userId: { caseId, userId } },
    create: { officeId: session.officeId, caseId, userId },
    update: {},
  });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.SYSTEM,
    description: t("event.assigneeAdded", { name: inOffice.name }),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "case.assign", resource: "cases", targetId: caseId, detail: userId });
}

export async function unassignUser(session: AppSession, caseId: string, userId: string, userName: string) {
  await requireModule(session, PermModule.CASES, "edit");
  const c = await prisma.case.findFirst({
    where: { id: caseId, officeId: session.officeId, deletedAt: null },
    include: { assignees: { select: { userId: true } } },
  });
  if (!c) throw new PermissionError("scope");
  if (!(await isCaseVisible(session, caseId, c.assignees.map((a) => a.userId))))
    throw new PermissionError("scope");

  await prisma.caseAssignee.deleteMany({ where: { caseId, userId } });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.SYSTEM,
    description: t("event.assigneeRemoved", { name: userName }),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "case.unassign", resource: "cases", targetId: caseId, detail: userId });
}

async function loadOwnCase(session: AppSession, caseId: string) {
  const c = await prisma.case.findFirst({
    where: { id: caseId, officeId: session.officeId, deletedAt: null },
    include: { assignees: { select: { userId: true } } },
  });
  if (!c) throw new PermissionError("scope");
  if (!(await isCaseVisible(session, caseId, c.assignees.map((a) => a.userId))))
    throw new PermissionError("scope");
  return c;
}

/**
 * Procedural-stage tracker (prototype proc.stage/log). A manual promote/remand
 * of the baseline stage — distinct from the hearing-derived `effectiveStage`.
 * Deliberately does NOT touch objectionDueAt: unlike the prototype's demo
 * shortcut (which set a 30-day objection window on every promotion), the real
 * objection deadline is only ever judgment-derived (docs/06 §1, see
 * hearings.recordHearing) — a manual stage bump is not a judgment.
 */
export async function promoteStage(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  const c = await loadOwnCase(session, caseId);
  const idx = STAGE_BY_INDEX.indexOf(c.stage);
  if (idx >= STAGE_BY_INDEX.length - 1) return c;
  const next = STAGE_BY_INDEX[idx + 1]!;
  const updated = await prisma.case.update({ where: { id: caseId }, data: { stage: next } });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.STAGE,
    description: t("event.stagePromoted", { stage: t(`case.stage.${next}`) }),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "case.stagePromote", resource: "cases", targetId: caseId, detail: next });
  return updated;
}

export async function remandStage(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  const c = await loadOwnCase(session, caseId);
  const idx = STAGE_BY_INDEX.indexOf(c.stage);
  if (idx <= 0) return c;
  const prev = STAGE_BY_INDEX[idx - 1]!;
  const updated = await prisma.case.update({ where: { id: caseId }, data: { stage: prev } });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.STAGE,
    description: t("event.stageRemanded", { stage: t(`case.stage.${prev}`) }),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "case.stageRemand", resource: "cases", targetId: caseId, detail: prev });
  return updated;
}

export async function endProcedure(session: AppSession, caseId: string, result: string) {
  await requireModule(session, PermModule.CASES, "edit");
  await loadOwnCase(session, caseId);
  const updated = await prisma.case.update({
    where: { id: caseId },
    data: { procEnded: true, procResult: result || null },
  });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.STAGE,
    description: t("event.procEnded", { result: result || "—" }),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "case.procEnd", resource: "cases", targetId: caseId });
  return updated;
}

export async function reopenProcedure(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  await loadOwnCase(session, caseId);
  const updated = await prisma.case.update({
    where: { id: caseId },
    data: { procEnded: false, procResult: null },
  });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.STAGE,
    description: t("event.procReopened"),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "case.procReopen", resource: "cases", targetId: caseId });
  return updated;
}

/** Fixed 4-item closing checklist (prototype closingHtml). */
export const CLOSING_CHECKLIST_ITEMS = [
  "finalSettlement",
  "returnClientDocs",
  "closeLinkedTasks",
  "archiveFile",
] as const;
export type ClosingChecklistKey = (typeof CLOSING_CHECKLIST_ITEMS)[number];

export async function toggleClosingChecklistItem(
  session: AppSession,
  caseId: string,
  key: ClosingChecklistKey,
) {
  await requireModule(session, PermModule.CASES, "edit");
  const c = await loadOwnCase(session, caseId);
  const checklist = (c.closingChecklist as Record<string, boolean> | null) ?? {};
  checklist[key] = !checklist[key];
  const updated = await prisma.case.update({ where: { id: caseId }, data: { closingChecklist: checklist } });
  await logAudit({ session, action: "case.closingChecklist", resource: "cases", targetId: caseId, detail: key });
  return updated;
}

export async function setClientSatisfaction(session: AppSession, caseId: string, score: number) {
  await requireModule(session, PermModule.CASES, "edit");
  await loadOwnCase(session, caseId);
  const clamped = Math.max(1, Math.min(5, Math.round(score)));
  const updated = await prisma.case.update({
    where: { id: caseId },
    data: { clientSatisfactionScore: clamped },
  });
  await logAudit({ session, action: "case.csat", resource: "cases", targetId: caseId, detail: String(clamped) });
  return updated;
}

export async function requestReferral(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  await loadOwnCase(session, caseId);
  const updated = await prisma.case.update({ where: { id: caseId }, data: { referralRequested: true } });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.SYSTEM,
    description: t("event.referralRequested"),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "case.referral", resource: "cases", targetId: caseId });
  return updated;
}

/** Archive + close the case (docs: 5-year retention business archive, distinct
 * from soft-delete). */
export async function archiveCase(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  await loadOwnCase(session, caseId);
  const updated = await prisma.case.update({
    where: { id: caseId },
    data: { isArchived: true, status: CaseStatus.CLOSED },
  });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.SYSTEM,
    description: t("event.caseArchived"),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "case.archive", resource: "cases", targetId: caseId });
  return updated;
}
