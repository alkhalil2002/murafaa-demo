import { CaseEventType, MessageSenderType, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logCaseEvent } from "@/lib/case-events";
import { t } from "@/lib/i18n";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, canAction, requireModule } from "@/lib/permissions/guard";
import { isCaseVisible, caseScopeWhere } from "@/lib/permissions/scope";

/**
 * Case chat (محادثة العميل) — a direct message thread between office staff
 * and the client on one case (prototype wsSendChat/renderChat). Staff-side
 * entry points live here, gated by the القضايا module + case row-scope. The
 * client-side entry point (src/server/portal/chat.ts) is gated by the
 * separate client-portal session instead.
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

const sendSchema = z.object({ body: z.string().trim().min(1).max(4000) });

export async function sendCaseMessage(session: AppSession, caseId: string, raw: z.infer<typeof sendSchema>) {
  await requireModule(session, PermModule.CASES, "edit");
  const input = sendSchema.parse(raw);
  await loadVisibleCase(session, caseId);
  const created = await prisma.caseMessage.create({
    data: {
      officeId: session.officeId,
      caseId,
      senderType: MessageSenderType.STAFF,
      senderUserId: session.userId,
      body: input.body,
    },
  });
  await logAudit({ session, action: "message.send", resource: "cases", targetId: caseId, detail: created.id });
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.MESSAGE,
    description: t("event.staffMessageSent"),
    actorUserId: session.userId,
  });
  return created;
}

export async function listCaseMessages(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.CASES, "view");
  await loadVisibleCase(session, caseId);
  return prisma.caseMessage.findMany({
    where: { officeId: session.officeId, caseId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Cases whose chat thread's last message is from the client (i.e. awaiting a
 * staff reply) — used to drive the notification feed. No read/unread column
 * exists on CaseMessage; "latest message is CLIENT" is the live signal, and
 * it naturally clears once staff sends a reply (mirrors listPendingApprovals).
 */
export async function listUnansweredClientMessages(session: AppSession) {
  if (!(await canAction(session, PermModule.CASES, "view"))) return [];
  const caseWhere = await caseScopeWhere(session);
  const latest = await prisma.caseMessage.findMany({
    where: { officeId: session.officeId, case: caseWhere },
    orderBy: [{ caseId: "asc" }, { createdAt: "desc" }],
    distinct: ["caseId"],
    include: { case: { select: { id: true, title: true } } },
  });
  return latest.filter((m) => m.senderType === MessageSenderType.CLIENT);
}
