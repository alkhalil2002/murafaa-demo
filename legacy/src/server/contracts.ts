import { CaseEventType, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logCaseEvent } from "@/lib/case-events";
import { t } from "@/lib/i18n";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { isCaseVisible } from "@/lib/permissions/scope";

/**
 * Case contracts list (عقود القضية, prototype wsAddContract/wsToggleContract).
 * Not documented in docs/01–06 — a plain, generic named-document tracker with
 * a signed/unsigned toggle, distinct from CaseFeeAgreement (Finance tab) and
 * the POA-expiry deadline field. Gated by القضايا module + case row-scope.
 */

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

async function loadOwnContract(session: AppSession, caseId: string, contractId: string) {
  await loadVisibleCase(session, caseId);
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, caseId, officeId: session.officeId, deletedAt: null },
  });
  if (!contract) throw new PermissionError("scope");
  return contract;
}

const addSchema = z.object({ title: z.string().trim().min(1) });

export async function addContract(session: AppSession, caseId: string, raw: z.infer<typeof addSchema>) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = addSchema.parse(raw);
  await loadVisibleCase(session, caseId);
  const created = await prisma.contract.create({
    data: { officeId: session.officeId, createdById: session.userId, caseId, title: input.title },
  });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.DOC,
    description: t("event.contractAdded", { title: input.title }),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "contract.add", resource: "cases", targetId: caseId, detail: created.id });
  return created;
}

export async function toggleContractSigned(session: AppSession, caseId: string, contractId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  const contract = await loadOwnContract(session, caseId, contractId);
  const nowSigned = !contract.isSigned;
  const updated = await prisma.contract.update({
    where: { id: contractId },
    data: { isSigned: nowSigned, signedAt: nowSigned ? new Date() : null },
  });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.DOC,
    description: t(nowSigned ? "event.contractSigned" : "event.contractUnsigned", { title: contract.title }),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "contract.toggleSigned", resource: "cases", targetId: caseId, detail: contractId });
  return updated;
}

export async function deleteContract(session: AppSession, caseId: string, contractId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  const contract = await loadOwnContract(session, caseId, contractId);
  await prisma.contract.update({ where: { id: contractId }, data: { deletedAt: new Date() } });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.DOC,
    description: t("event.contractDeleted", { title: contract.title }),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "contract.delete", resource: "cases", targetId: caseId, detail: contractId });
}

export async function listContracts(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.CASES, "view");
  await loadVisibleCase(session, caseId);
  return prisma.contract.findMany({
    where: { officeId: session.officeId, caseId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}
