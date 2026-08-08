import { MessageSenderType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logSystemAudit } from "@/lib/audit";
import { getStorage } from "@/lib/storage";
import type { PortalSession } from "@/lib/auth/portal-session";

/**
 * Client-portal read/write surface (بوابة العميل, Phase 8). Every function
 * here is gated by an explicit PortalSession (never the staff AppSession) and
 * scoped to exactly that client's own cases — a client can never see another
 * client's data, and there is no "view all" mode. Mirrors the staff service
 * layer's row-scope discipline but with a single, fixed scope (their own
 * clientId) instead of the role-based CaseScope matrix.
 */

async function loadOwnPortalCase(session: PortalSession, caseId: string) {
  const c = await prisma.case.findFirst({
    where: { id: caseId, officeId: session.officeId, clientId: session.clientId, deletedAt: null },
  });
  if (!c) throw new Error("PORTAL_SCOPE");
  return c;
}

export async function listPortalCases(session: PortalSession) {
  return prisma.case.findMany({
    where: { officeId: session.officeId, clientId: session.clientId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      hearings: { where: { status: "UPCOMING", deletedAt: null }, orderBy: { hearingDate: "asc" }, take: 1 },
    },
  });
}

export async function getPortalCase(session: PortalSession, caseId: string) {
  const c = await loadOwnPortalCase(session, caseId);
  const upcoming = await prisma.hearing.findFirst({
    where: { caseId, status: "UPCOMING", deletedAt: null },
    orderBy: { hearingDate: "asc" },
  });
  return { ...c, upcomingHearing: upcoming };
}

export async function listPortalDocuments(session: PortalSession, caseId: string) {
  await loadOwnPortalCase(session, caseId);
  return prisma.document.findMany({
    where: { officeId: session.officeId, caseId, clientVisible: true, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Portal-safe document download. Mirrors documents.ts#getDocumentForDownload
 * but checks the fixed client scope + clientVisible instead of staff module
 * permissions — the download route previously only accepted a staff
 * AppSession, so a client-visible document (e.g. an approved hearing
 * report) had no way to actually be downloaded from the portal.
 */
export async function getPortalDocumentForDownload(session: PortalSession, id: string) {
  const doc = await prisma.document.findFirst({
    where: { id, officeId: session.officeId, clientVisible: true, deletedAt: null },
  });
  if (!doc || !doc.caseId) throw new Error("PORTAL_SCOPE");
  await loadOwnPortalCase(session, doc.caseId);
  const bytes = await getStorage().get(doc.storageKey);
  await logSystemAudit(session.officeId, "portal.document.download", `client=${session.clientId} doc=${doc.id}`);
  return { fileName: doc.fileName, mimeType: doc.mimeType, bytes };
}

export async function listPortalMessages(session: PortalSession, caseId: string) {
  await loadOwnPortalCase(session, caseId);
  return prisma.caseMessage.findMany({
    where: { officeId: session.officeId, caseId },
    orderBy: { createdAt: "asc" },
  });
}

const sendSchema = z.object({ body: z.string().trim().min(1).max(4000) });

export async function sendPortalMessage(session: PortalSession, caseId: string, raw: z.infer<typeof sendSchema>) {
  const input = sendSchema.parse(raw);
  await loadOwnPortalCase(session, caseId);
  const created = await prisma.caseMessage.create({
    data: {
      officeId: session.officeId,
      caseId,
      senderType: MessageSenderType.CLIENT,
      body: input.body,
    },
  });
  await logSystemAudit(
    session.officeId,
    "portal.message.send",
    `client=${session.clientId} case=${caseId} message=${created.id}`,
  );
  return created;
}
