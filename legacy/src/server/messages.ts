import { MessageSenderType, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { isCaseVisible } from "@/lib/permissions/scope";

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
