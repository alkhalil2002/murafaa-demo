import { CaseEventType, ClientCommunicationType, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logCaseEvent } from "@/lib/case-events";
import { t } from "@/lib/i18n";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { isCaseVisible } from "@/lib/permissions/scope";

/**
 * Client communication log (prototype "سجل التواصل مع العميل") — a running
 * log of client contact touchpoints on the Parties tab, distinct from any
 * live chat/portal messaging (Phase 8). Gated by the القضايا module + case
 * row-scope, same as hearings/procedure requests.
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

async function loadOwnCommunication(session: AppSession, caseId: string, commId: string) {
  await loadVisibleCase(session, caseId);
  const comm = await prisma.clientCommunication.findFirst({
    where: { id: commId, caseId, officeId: session.officeId, deletedAt: null },
  });
  if (!comm) throw new PermissionError("scope");
  return comm;
}

const addSchema = z.object({
  type: z.nativeEnum(ClientCommunicationType),
  note: z.string().trim().min(1),
});

export async function addClientCommunication(session: AppSession, caseId: string, raw: z.infer<typeof addSchema>) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = addSchema.parse(raw);
  await loadVisibleCase(session, caseId);
  const created = await prisma.clientCommunication.create({
    data: {
      officeId: session.officeId,
      createdById: session.userId,
      caseId,
      type: input.type,
      note: input.note,
    },
  });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.MESSAGE,
    description: t("event.communicationAdded", { type: t(`clientCommunicationType.${input.type}`) }),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "communication.add", resource: "cases", targetId: caseId, detail: created.id });
  return created;
}

export async function deleteClientCommunication(session: AppSession, caseId: string, commId: string) {
  await requireModule(session, PermModule.CASES, "edit");
  await loadOwnCommunication(session, caseId, commId);
  await prisma.clientCommunication.update({ where: { id: commId }, data: { deletedAt: new Date() } });
  await logAudit({ session, action: "communication.delete", resource: "cases", targetId: caseId, detail: commId });
}

export async function listClientCommunications(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.CASES, "view");
  await loadVisibleCase(session, caseId);
  return prisma.clientCommunication.findMany({
    where: { officeId: session.officeId, caseId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}
