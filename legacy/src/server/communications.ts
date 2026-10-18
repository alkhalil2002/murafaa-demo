import { CaseEventType, ClientCommunicationType, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logCaseEvent } from "@/lib/case-events";
import { t } from "@/lib/i18n";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { isCaseVisible, caseScopeWhere } from "@/lib/permissions/scope";

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

/**
 * واتساب (docs/05) — a real, cross-case log of MESSAGE-kind touchpoints,
 * scoped to cases visible to the caller. This is genuinely all we have: no
 * WhatsApp Business API integration exists yet (docs/02 Phase 7), so there
 * is no live inbox/auto-responder to show — only what staff already log via
 * a case's "سجل التواصل" tab. Deliberately NOT a fabricated chat UI.
 */
export async function listMessageCommunications(session: AppSession) {
  await requireModule(session, PermModule.WHATSAPP, "view");
  const caseWhere = await caseScopeWhere(session);
  return prisma.clientCommunication.findMany({
    where: {
      officeId: session.officeId,
      deletedAt: null,
      type: ClientCommunicationType.MESSAGE,
      case: caseWhere,
    },
    orderBy: { createdAt: "desc" },
    include: { case: { select: { id: true, title: true, client: { select: { name: true, phone: true } } } } },
  });
}
