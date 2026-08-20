import { randomUUID } from "node:crypto";
import { CaseEventType, ClientApprovalStatus, DocKind, DocSource, MessageSenderType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logSystemAudit } from "@/lib/audit";
import { logCaseEvent } from "@/lib/case-events";
import { t } from "@/lib/i18n";
import { documentKey, getStorage } from "@/lib/storage";
import { invoiceStatus, paidOf, remainingOf } from "@/lib/finance/core";
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
  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId,
    type: CaseEventType.MESSAGE,
    description: t("event.clientMessageSent"),
  });
  return created;
}

// ── Client approvals (اعتمادات) ──

export async function listPortalApprovals(session: PortalSession, caseId: string) {
  await loadOwnPortalCase(session, caseId);
  return prisma.clientApprovalRequest.findMany({
    where: { officeId: session.officeId, caseId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

const decideSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(2000).nullish(),
});

export async function decidePortalApproval(
  session: PortalSession,
  caseId: string,
  approvalId: string,
  approve: boolean,
  note?: string | null,
) {
  const input = decideSchema.parse({ approve, note });
  await loadOwnPortalCase(session, caseId);
  const approval = await prisma.clientApprovalRequest.findFirst({
    where: { id: approvalId, officeId: session.officeId, caseId, deletedAt: null },
  });
  if (!approval) throw new Error("PORTAL_SCOPE");
  if (approval.status !== ClientApprovalStatus.PENDING) throw new Error("APPROVAL_ALREADY_DECIDED");
  const updated = await prisma.clientApprovalRequest.update({
    where: { id: approvalId },
    data: {
      status: input.approve ? ClientApprovalStatus.APPROVED : ClientApprovalStatus.REJECTED,
      decisionNote: input.note ?? null,
    },
  });
  await logSystemAudit(
    session.officeId,
    "portal.approval.decide",
    `client=${session.clientId} case=${caseId} approval=${approvalId} decision=${updated.status}`,
  );
  return updated;
}

// ── Client document upload (رفع مستندات) ──

const MAX_PORTAL_UPLOAD_BYTES = 20 * 1024 * 1024;

function kindForMime(mime: string): DocKind {
  if (mime.startsWith("image/")) return DocKind.IMAGE;
  if (mime === "text/plain") return DocKind.TEXT;
  if (mime === "application/pdf") return DocKind.DOCUMENT;
  return DocKind.FILE;
}

export async function uploadPortalDocument(
  session: PortalSession,
  caseId: string,
  file: { fileName: string; mimeType: string; bytes: Buffer },
) {
  if (file.bytes.length === 0 || file.bytes.length > MAX_PORTAL_UPLOAD_BYTES) throw new Error("UPLOAD_SIZE_REJECTED");
  await loadOwnPortalCase(session, caseId);

  const id = randomUUID();
  const storageKey = documentKey({
    officeId: session.officeId,
    caseId,
    documentId: id,
    filename: file.fileName,
  });
  await getStorage().put(storageKey, file.bytes, file.mimeType);

  const doc = await prisma.document.create({
    data: {
      id,
      officeId: session.officeId,
      caseId,
      fileName: file.fileName,
      kind: kindForMime(file.mimeType),
      source: DocSource.CLIENT,
      clientVisible: true,
      storageKey,
      mimeType: file.mimeType,
      sizeBytes: file.bytes.length,
    },
  });
  await logSystemAudit(
    session.officeId,
    "portal.document.upload",
    `client=${session.clientId} case=${caseId} doc=${doc.id}`,
  );
  return doc;
}

// ── Invoices (دفع) ──

export async function listPortalInvoices(session: PortalSession) {
  const rows = await prisma.invoice.findMany({
    where: { officeId: session.officeId, clientId: session.clientId, deletedAt: null },
    orderBy: { issueDate: "desc" },
    include: { case: { select: { title: true } }, payments: { where: { isApproved: true }, select: { amount: true } } },
  });
  return rows.map((inv) => {
    const paid = paidOf(inv.payments);
    return {
      id: inv.id,
      number: inv.number,
      caseTitle: inv.case?.title ?? null,
      issueDate: inv.issueDate,
      total: inv.totalAmount,
      paid,
      remaining: remainingOf(inv.totalAmount, paid),
      status: invoiceStatus(inv, paid),
    };
  });
}
