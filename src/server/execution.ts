import { ExecutionFileStatus, ExecutionProcStatus, PermModule } from "@prisma/client";
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
    include: { procedures: { orderBy: { createdAt: "desc" } } },
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

export async function setExecutionStatus(session: AppSession, id: string, status: ExecutionFileStatus) {
  await requireModule(session, PermModule.CASES, "edit");
  const ex = await loadOwnExecution(session, id);
  const updated = await prisma.caseExecution.update({ where: { id }, data: { status } });
  await logAudit({ session, action: "execution.status", resource: "cases", targetId: ex.caseId, detail: status });
  return updated;
}

export async function recordCollection(session: AppSession, id: string, amountMinor: number) {
  await requireModule(session, PermModule.CASES, "edit");
  if (!Number.isInteger(amountMinor) || amountMinor <= 0 || amountMinor > MAX_HALALAS) {
    throw new Error("EXECUTION_COLLECTION_INVALID");
  }
  const ex = await loadOwnExecution(session, id);
  const updated = await prisma.caseExecution.update({
    where: { id },
    data: { collectedMinor: { increment: amountMinor } },
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

const addProcSchema = z.object({ type: z.string().trim().min(1), note: z.string().trim().nullish() });

export async function addExecutionProcedure(session: AppSession, executionId: string, raw: { type: string; note?: string | null }) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = addProcSchema.parse(raw);
  await loadOwnExecution(session, executionId);
  return prisma.executionProcedure.create({
    data: { caseExecutionId: executionId, type: input.type, note: input.note ?? null },
  });
}

export async function cycleExecutionProcedure(session: AppSession, procedureId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  const proc = await prisma.executionProcedure.findFirst({
    where: { id: procedureId },
    include: { caseExecution: true },
  });
  if (!proc || proc.caseExecution.officeId !== session.officeId || proc.caseExecution.deletedAt) {
    throw new PermissionError("scope");
  }
  await loadVisibleCase(session, proc.caseExecution.caseId);
  const idx = PROC_STATUS_ORDER.indexOf(proc.status);
  const next = PROC_STATUS_ORDER[(idx + 1) % PROC_STATUS_ORDER.length]!;
  return prisma.executionProcedure.update({ where: { id: procedureId }, data: { status: next } });
}
