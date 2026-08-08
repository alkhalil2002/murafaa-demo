import {
  DocParty,
  ExecutionFileStatus,
  ExecutionProcStatus,
  PermModule,
  TaskCategory,
  TaskSource,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logCaseEvent } from "@/lib/case-events";
import { CaseEventType } from "@prisma/client";
import { t } from "@/lib/i18n";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { isCaseVisible } from "@/lib/permissions/scope";
import { MAX_HALALAS } from "@/lib/finance/core";

/**
 * Post-judgment execution/enforcement file (تنفيذ), prototype's exec* block.
 * One optional CaseExecution per case, opened once a judgment is being
 * enforced against the debtor, with a list of enforcement procedures.
 */

const PROC_STATUS_ORDER: ExecutionProcStatus[] = [
  ExecutionProcStatus.REQUIRED,
  ExecutionProcStatus.IN_PROGRESS,
  ExecutionProcStatus.EXECUTED,
  ExecutionProcStatus.STALLED,
];

/// Standardized enforcement-procedure type picklist (prototype EXEC_PROC_TYPES) —
/// free-text descriptor, not an enforced enum, mirrors Document.docType's convention.
export const EXEC_PROC_TYPES = [
  "طلب التنفيذ",
  "أمر التنفيذ",
  "تبليغ المنفذ ضده",
  "حجز حسابات بنكية",
  "حجز عقار",
  "حجز مركبات",
  "حجز أسهم",
  "منع سفر",
  "إيقاف خدمات أبشر",
  "الإفصاح عن الأصول",
  "التحصيل/السداد",
  "البيع بالمزاد",
  "إغلاق الملف",
  "أخرى",
] as const;

async function loadVisibleCase(session: AppSession, caseId: string) {
  const c = await prisma.case.findFirst({
    where: { id: caseId, officeId: session.officeId, deletedAt: null },
    include: { assignees: { select: { userId: true } } },
  });
  if (!c) throw new PermissionError("scope");
  if (!(await isCaseVisible(session, caseId, c.assignees.map((a) => a.userId))))
    throw new PermissionError("scope");
  return c;
}

export async function getExecution(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.CASES, "view");
  await loadVisibleCase(session, caseId);
  return prisma.caseExecution.findFirst({
    where: { caseId, officeId: session.officeId, deletedAt: null },
    include: { procedures: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } } },
  });
}

const openSchema = z.object({
  court: z.string().trim().nullish(),
  requestNo: z.string().trim().nullish(),
  amountMinor: z.number().int().nonnegative().max(MAX_HALALAS).nullish(),
  debtor: z.string().trim().nullish(),
  basis: z.string().trim().nullish(),
  openedAt: z.coerce.date().nullish(),
});
export type OpenExecutionInput = z.infer<typeof openSchema>;

export async function openExecution(session: AppSession, caseId: string, raw: OpenExecutionInput) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = openSchema.parse(raw);
  await loadVisibleCase(session, caseId);
  const existing = await prisma.caseExecution.findFirst({
    where: { caseId, officeId: session.officeId, deletedAt: null },
  });
  if (existing) throw new Error("EXECUTION_ALREADY_OPEN");

  const created = await prisma.caseExecution.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      caseId,
      court: input.court ?? null,
      requestNo: input.requestNo ?? null,
      amountMinor: input.amountMinor ?? null,
      debtor: input.debtor ?? null,
      basis: input.basis ?? null,
      openedAt: input.openedAt ?? new Date(),
      status: ExecutionFileStatus.ACTIVE,
    },
  });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.SYSTEM,
    description: t("event.executionOpened"),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "execution.open", resource: "cases", targetId: created.id });
  return created;
}

async function loadOwnExecution(session: AppSession, id: string) {
  const ex = await prisma.caseExecution.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
  });
  if (!ex) throw new PermissionError("scope");
  await loadVisibleCase(session, ex.caseId);
  return ex;
}

const updateSchema = z.object({
  court: z.string().trim().nullish(),
  requestNo: z.string().trim().nullish(),
  amountMinor: z.number().int().nonnegative().max(MAX_HALALAS).nullish(),
  debtor: z.string().trim().nullish(),
  basis: z.string().trim().nullish(),
});
export type UpdateExecutionInput = z.infer<typeof updateSchema>;

/** Correct the execution file's core data after opening (prototype execEditFile/execSaveFile) — court/request#/amount/debtor/basis were previously locked in at open time. */
export async function updateExecution(session: AppSession, id: string, raw: UpdateExecutionInput) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = updateSchema.parse(raw);
  const ex = await loadOwnExecution(session, id);
  const updated = await prisma.caseExecution.update({
    where: { id },
    data: {
      court: input.court ?? null,
      requestNo: input.requestNo ?? null,
      amountMinor: input.amountMinor ?? null,
      debtor: input.debtor ?? null,
      basis: input.basis ?? null,
    },
  });
  await logAudit({ session, action: "execution.update", resource: "cases", targetId: ex.caseId });
  return updated;
}

export async function setExecutionStatus(session: AppSession, id: string, status: ExecutionFileStatus) {
  await requireModule(session, PermModule.CASES, "edit");
  const ex = await loadOwnExecution(session, id);
  const updated = await prisma.caseExecution.update({ where: { id }, data: { status } });
  await logAudit({ session, action: "execution.status", resource: "cases", targetId: ex.caseId, detail: status });
  return updated;
}

/** One-click close (prototype execClose) — distinct from the generic status
 * dropdown so closing always leaves its own audit-trail event. */
export async function closeExecution(session: AppSession, id: string) {
  await requireModule(session, PermModule.CASES, "edit");
  const ex = await loadOwnExecution(session, id);
  const updated = await prisma.caseExecution.update({ where: { id }, data: { status: ExecutionFileStatus.CLOSED } });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId: ex.caseId,
    type: CaseEventType.SYSTEM,
    description: t("event.executionClosed"),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "execution.close", resource: "cases", targetId: ex.caseId });
  return updated;
}

/** Auto file-status transition on collection (prototype execSetCollected):
 * fully collected once the collected amount reaches the claimed amount,
 * partially collected otherwise — never overrides a manually-set CLOSED or
 * STALLED status, since those reflect a deliberate staff decision. */
function statusAfterCollection(
  current: ExecutionFileStatus,
  amountMinor: number | null,
  collectedMinor: number,
): ExecutionFileStatus {
  if (current === ExecutionFileStatus.CLOSED || current === ExecutionFileStatus.STALLED) return current;
  if (amountMinor != null && collectedMinor >= amountMinor) return ExecutionFileStatus.FULLY_COLLECTED;
  if (collectedMinor > 0) return ExecutionFileStatus.PARTIALLY_COLLECTED;
  return current;
}

export async function recordCollection(session: AppSession, id: string, amountMinor: number) {
  await requireModule(session, PermModule.CASES, "edit");
  if (!Number.isInteger(amountMinor) || amountMinor <= 0 || amountMinor > MAX_HALALAS) {
    throw new Error("EXECUTION_COLLECTION_INVALID");
  }
  const ex = await loadOwnExecution(session, id);
  const newCollected = ex.collectedMinor + amountMinor;
  const updated = await prisma.caseExecution.update({
    where: { id },
    data: {
      collectedMinor: { increment: amountMinor },
      status: statusAfterCollection(ex.status, ex.amountMinor, newCollected),
    },
  });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId: ex.caseId,
    type: CaseEventType.SYSTEM,
    description: t("event.executionCollected"),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "execution.collect", resource: "cases", targetId: ex.caseId, detail: String(amountMinor) });
  return updated;
}

const addProcSchema = z.object({
  type: z.string().trim().min(1),
  note: z.string().trim().nullish(),
  party: z.nativeEnum(DocParty).nullish(),
  date: z.coerce.date().nullish(),
  followUpDate: z.coerce.date().nullish(),
  followUpAssigneeId: z.string().uuid().nullish(),
});
export type AddExecutionProcedureInput = z.infer<typeof addProcSchema>;

/** A follow-up date auto-creates a linked reminder (+ a task if an assignee
 * is given), prototype execSyncFollowReminder/execSyncFollowTask — set once
 * at creation, so the staff member doesn't have to separately remember to
 * add a reminder for the enforcement step they just logged. */
export async function addExecutionProcedure(session: AppSession, executionId: string, raw: AddExecutionProcedureInput) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = addProcSchema.parse(raw);
  const ex = await loadOwnExecution(session, executionId);

  return prisma.$transaction(async (tx) => {
    const created = await tx.executionProcedure.create({
      data: {
        caseExecutionId: executionId,
        createdById: session.userId,
        type: input.type,
        note: input.note ?? null,
        party: input.party ?? null,
        date: input.date ?? null,
        followUpDate: input.followUpDate ?? null,
        followUpAssigneeId: input.followUpAssigneeId ?? null,
      },
    });
    if (input.followUpDate) {
      const reminder = await tx.caseReminder.create({
        data: {
          officeId: session.officeId,
          createdById: session.userId,
          caseId: ex.caseId,
          text: t("cases.execution.followUpReminderText", { type: input.type }),
          dueOn: input.followUpDate,
        },
      });
      await tx.executionProcedure.update({ where: { id: created.id }, data: { reminderId: reminder.id } });
      if (input.followUpAssigneeId) {
        await tx.task.create({
          data: {
            officeId: session.officeId,
            createdById: session.userId,
            caseId: ex.caseId,
            title: t("cases.execution.followUpReminderText", { type: input.type }),
            assigneeId: input.followUpAssigneeId,
            dueAt: input.followUpDate,
            category: TaskCategory.PROCEDURAL_FOLLOWUP,
            origin: TaskSource.AUTO_EXECUTION_FOLLOWUP,
          },
        });
      }
    }
    return created;
  });
}

async function loadOwnProcedure(session: AppSession, procedureId: string) {
  const proc = await prisma.executionProcedure.findFirst({
    where: { id: procedureId, deletedAt: null },
    include: { caseExecution: true },
  });
  if (!proc || proc.caseExecution.officeId !== session.officeId || proc.caseExecution.deletedAt) {
    throw new PermissionError("scope");
  }
  await loadVisibleCase(session, proc.caseExecution.caseId);
  return proc;
}

export async function updateExecutionProcedure(session: AppSession, procedureId: string, raw: AddExecutionProcedureInput) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = addProcSchema.parse(raw);
  await loadOwnProcedure(session, procedureId);
  return prisma.executionProcedure.update({
    where: { id: procedureId },
    data: { type: input.type, note: input.note ?? null, party: input.party ?? null, date: input.date ?? null },
  });
}

export async function deleteExecutionProcedure(session: AppSession, procedureId: string) {
  await requireModule(session, PermModule.CASES, "delete");
  await loadOwnProcedure(session, procedureId);
  await prisma.executionProcedure.update({ where: { id: procedureId }, data: { deletedAt: new Date() } });
}

export async function cycleExecutionProcedure(session: AppSession, procedureId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  const proc = await loadOwnProcedure(session, procedureId);
  const idx = PROC_STATUS_ORDER.indexOf(proc.status);
  const next = PROC_STATUS_ORDER[(idx + 1) % PROC_STATUS_ORDER.length]!;
  return prisma.executionProcedure.update({ where: { id: procedureId }, data: { status: next } });
}
