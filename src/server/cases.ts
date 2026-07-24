import { CaseEventType, HearingStatus, PermModule, ProcStage } from "@prisma/client";
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
  clientId: z.string().uuid().nullish(),
  opposingParty: z.string().trim().nullish(),
  najizMainClass: z.string().nullish(),
  najizSubClass: z.string().nullish(),
  najizCaseType: z.string().nullish(),
  city: z.string().nullish(),
  stage: z.nativeEnum(ProcStage).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
});
export type CreateCaseInput = z.infer<typeof createSchema>;

const updateSchema = createSchema.partial();
export type UpdateCaseInput = z.infer<typeof updateSchema>;

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
      stage: true,
      status: true,
      conflictSeverity: true,
      client: { select: { id: true, name: true } },
      assignees: { select: { userId: true } },
    },
  });
}

export async function getCase(session: AppSession, id: string) {
  await requireModule(session, PermModule.CASES, "view");
  const found = await prisma.case.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
    include: {
      client: { select: { id: true, name: true } },
      assignees: { include: { user: { select: { id: true, name: true } } } },
      hearings: { where: { deletedAt: null }, orderBy: { hearingDate: "asc" } },
      events: { orderBy: { occurredAt: "desc" }, take: 50 },
      conflictFlags: true,
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
    if (input.clientId) {
      const owned = await tx.client.findFirst({
        where: { id: input.clientId, officeId: session.officeId, deletedAt: null },
        select: { id: true },
      });
      if (!owned) throw new PermissionError("scope");
    }
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
        clientId: input.clientId ?? null,
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
        najizMainClass: input.najizMainClass,
        najizSubClass: input.najizSubClass,
        najizCaseType: input.najizCaseType,
        city: input.city,
        stage: input.stage,
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

export async function assignUser(session: AppSession, caseId: string, userId: string, userName: string) {
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
    select: { id: true },
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
    description: t("event.assigneeAdded", { name: userName }),
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
