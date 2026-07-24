import { randomUUID } from "node:crypto";
import { DocKind, DocParty, DocSource, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { logCaseEvent } from "@/lib/case-events";
import { CaseEventType } from "@prisma/client";
import { t } from "@/lib/i18n";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, mayViewField, requireCaseAccess, requireModule } from "@/lib/permissions/guard";
import { documentKey, getStorage } from "@/lib/storage";
import { renderPdf } from "@/lib/pdf/render";
import { letterheadHtml, resolveBranding } from "@/lib/pdf/letterhead";
import { formatHijri, prepareFields, renderBody, type CaseAutofill } from "@/lib/documents/render";
import { getTemplateByKey, templateFields } from "./templates";

/**
 * Documents service (docs/03, docs/05, docs/06 §doc rules). Generates letterhead
 * PDFs from templates, ingests uploads, lists/streams/soft-deletes, and toggles
 * client-portal sharing. Every path is gated by the المستندات module, case
 * row-scope, office tenancy, and audited. Binary lives in object storage; the
 * DB row is metadata + storage key.
 */

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const UPLOAD_MIME_ALLOW = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function kindForMime(mime: string): DocKind {
  if (mime.startsWith("image/")) return DocKind.IMAGE;
  if (mime === "text/plain") return DocKind.TEXT;
  if (mime === "application/pdf") return DocKind.DOCUMENT;
  return DocKind.FILE;
}

/** Load a case the caller may see (throws scope otherwise) + its autofill data. */
async function loadCaseForDocs(session: AppSession, caseId: string) {
  const c = await prisma.case.findFirst({
    where: { id: caseId, officeId: session.officeId, deletedAt: null },
    select: {
      id: true,
      opposingParty: true,
      najizCaseType: true,
      city: true,
      client: { select: { name: true } },
      assignees: { select: { userId: true } },
    },
  });
  if (!c) throw new PermissionError("scope");
  await requireCaseAccess(session, caseId, c.assignees.map((a) => a.userId));
  const autofill: CaseAutofill = {
    clientName: c.client?.name ?? null,
    opposingParty: c.opposingParty,
    caseType: c.najizCaseType,
    city: c.city,
  };
  return autofill;
}

/**
 * Build the generate form (fields + autofilled defaults) for a template,
 * honoring field-deny + case row-scope. Used by the generate page.
 */
export async function prepareGenerateForm(
  session: AppSession,
  templateKey: string,
  caseId?: string | null,
) {
  await requireModule(session, PermModule.DOCUMENTS, "edit");
  const template = await getTemplateByKey(session, templateKey);
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");

  let caseData: CaseAutofill | null = null;
  let caseTitle: string | null = null;
  if (caseId) {
    caseData = await loadCaseForDocs(session, caseId);
    const cx = await prisma.case.findUnique({ where: { id: caseId }, select: { title: true } });
    caseTitle = cx?.title ?? null;
  }
  const feesDenied = !(await mayViewField(session, "cases", "fees"));
  const { fields, values } = prepareFields(templateFields(template.fields), caseData, { feesDenied });
  return {
    template: { key: template.key, title: template.title },
    fields,
    values,
    caseId: caseId ?? null,
    caseTitle,
  };
}

const generateSchema = z.object({
  templateKey: z.string().min(1),
  caseId: z.string().uuid().nullish(),
  values: z.record(z.string(), z.string()).default({}),
});
export type GenerateInput = z.infer<typeof generateSchema>;

export async function generateFromTemplate(session: AppSession, raw: GenerateInput) {
  await requireModule(session, PermModule.DOCUMENTS, "edit");
  const input = generateSchema.parse(raw);

  const template = await getTemplateByKey(session, input.templateKey);
  if (!template) throw new Error("TEMPLATE_NOT_FOUND");

  const caseData = input.caseId ? await loadCaseForDocs(session, input.caseId) : null;

  // Field-deny (layer 2): assistant is blocked from fee data → strip fee fields.
  const feesDenied = !(await mayViewField(session, "cases", "fees"));
  const { fields: allowed, values: defaults } = prepareFields(
    templateFields(template.fields),
    caseData,
    { feesDenied },
  );
  const allowedIds = new Set(allowed.map((f) => f.id));
  const finalValues: Record<string, string> = { ...defaults };
  for (const [k, v] of Object.entries(input.values)) {
    if (allowedIds.has(k)) finalValues[k] = v; // ignore denied/unknown fields
  }

  const office = await prisma.office.findUniqueOrThrow({
    where: { id: session.officeId },
    select: { name: true, branding: true },
  });
  const branding = resolveBranding(office.branding ?? { name: office.name });

  const generatedDate = new Date();
  const bodyHtml = renderBody(template.bodyTemplate, finalValues, branding.name);
  const html = letterheadHtml({
    branding,
    title: template.title,
    bodyHtml,
    hijriDate: formatHijri(generatedDate),
  });
  const pdf = await renderPdf(html);

  const id = randomUUID();
  const fileName = `${template.title}.pdf`;
  const storageKey = documentKey({
    officeId: session.officeId,
    caseId: input.caseId ?? null,
    documentId: id,
    filename: fileName,
  });
  await getStorage().put(storageKey, pdf, "application/pdf");

  // Compensation is scoped to the row insert ONLY: if the Document row fails to
  // persist, remove the orphaned object. Side effects (timeline, audit) run
  // AFTER the row is durable so a post-commit failure never deletes the bytes.
  let doc;
  try {
    doc = await prisma.document.create({
      data: {
        id,
        officeId: session.officeId,
        caseId: input.caseId ?? null,
        createdById: session.userId,
        fileName,
        kind: DocKind.DOCUMENT,
        source: DocSource.TEMPLATE,
        party: DocParty.OURS,
        docType: "مُولّد",
        storageKey,
        mimeType: "application/pdf",
        sizeBytes: pdf.length,
        templateId: template.id,
        fieldValues: finalValues,
        renderedHtml: html,
        generatedDate,
      },
    });
  } catch (err) {
    await getStorage().delete(storageKey).catch(() => {});
    throw err;
  }

  if (input.caseId) {
    await logCaseEvent(prisma, {
      officeId: session.officeId,
      caseId: input.caseId,
      type: CaseEventType.DOC,
      description: t("event.docGenerated", { name: template.title }),
      actorUserId: session.userId,
    });
  }
  await logAudit({
    session,
    action: "document.generate",
    resource: "documents",
    targetId: doc.id,
    detail: `${template.key} → ${fileName}`,
  });
  return doc;
}

const uploadSchema = z.object({
  caseId: z.string().uuid(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  docType: z.string().nullish(),
  party: z.nativeEnum(DocParty).nullish(),
});
export type UploadInput = z.infer<typeof uploadSchema>;

export async function uploadDocument(session: AppSession, raw: UploadInput, bytes: Buffer) {
  await requireModule(session, PermModule.DOCUMENTS, "edit");
  const input = uploadSchema.parse(raw);
  if (!UPLOAD_MIME_ALLOW.has(input.mimeType)) throw new Error("UPLOAD_MIME_REJECTED");
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) throw new Error("UPLOAD_SIZE_REJECTED");
  await loadCaseForDocs(session, input.caseId);

  const id = randomUUID();
  const storageKey = documentKey({
    officeId: session.officeId,
    caseId: input.caseId,
    documentId: id,
    filename: input.fileName,
  });
  await getStorage().put(storageKey, bytes, input.mimeType);

  let doc;
  try {
    doc = await prisma.document.create({
      data: {
        id,
        officeId: session.officeId,
        caseId: input.caseId,
        createdById: session.userId,
        fileName: input.fileName,
        kind: kindForMime(input.mimeType),
        source: DocSource.UPLOAD,
        party: input.party ?? null,
        docType: input.docType ?? null,
        storageKey,
        mimeType: input.mimeType,
        sizeBytes: bytes.length,
        needsOcr: input.mimeType.startsWith("image/"),
      },
    });
  } catch (err) {
    // Only compensate the orphaned object on row-insert failure (see generate).
    await getStorage().delete(storageKey).catch(() => {});
    throw err;
  }

  await logCaseEvent(prisma, {
    officeId: session.officeId,
    caseId: input.caseId,
    type: CaseEventType.DOC,
    description: t("event.docUploaded", { name: input.fileName }),
    actorUserId: session.userId,
  });
  await logAudit({ session, action: "document.upload", resource: "documents", targetId: doc.id });
  return doc;
}

export async function listDocuments(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.DOCUMENTS, "view");
  await loadCaseForDocs(session, caseId);
  return prisma.document.findMany({
    where: { officeId: session.officeId, caseId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { template: { select: { title: true } } },
  });
}

/** Load a document + its bytes for an authorized download (audited). */
export async function getDocumentForDownload(session: AppSession, id: string) {
  await requireModule(session, PermModule.DOCUMENTS, "view");
  const doc = await prisma.document.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
  });
  if (!doc) throw new PermissionError("scope");
  if (doc.caseId) {
    const assignees = await prisma.caseAssignee.findMany({
      where: { caseId: doc.caseId },
      select: { userId: true },
    });
    await requireCaseAccess(session, doc.caseId, assignees.map((a) => a.userId));
  }
  const bytes = await getStorage().get(doc.storageKey);
  await logAudit({ session, action: "document.download", resource: "documents", targetId: doc.id });
  return { fileName: doc.fileName, mimeType: doc.mimeType, bytes };
}

export async function toggleShare(session: AppSession, id: string) {
  await requireModule(session, PermModule.DOCUMENTS, "edit");
  const doc = await prisma.document.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
  });
  if (!doc) throw new PermissionError("scope");
  if (doc.caseId) {
    const assignees = await prisma.caseAssignee.findMany({
      where: { caseId: doc.caseId },
      select: { userId: true },
    });
    await requireCaseAccess(session, doc.caseId, assignees.map((a) => a.userId));
  }
  const nowVisible = !doc.clientVisible;
  const updated = await prisma.document.update({
    where: { id },
    data: {
      clientVisible: nowVisible,
      clientSharedAt: nowVisible ? new Date() : null,
      clientSharedById: nowVisible ? session.userId : null,
    },
  });
  await logAudit({
    session,
    action: nowVisible ? "document.share" : "document.unshare",
    resource: "documents",
    targetId: id,
  });
  return updated;
}

export async function softDeleteDocument(session: AppSession, id: string) {
  // Delete is a FULL-level action → partner only (docs/04).
  await requireModule(session, PermModule.DOCUMENTS, "delete");
  const doc = await prisma.document.findFirst({
    where: { id, officeId: session.officeId, deletedAt: null },
  });
  if (!doc) throw new PermissionError("scope");
  // Layer 3: a caller who cannot see the document's case cannot delete its docs
  // (mirrors download/share; matters once a role is elevated to FULL+ASSIGNED).
  if (doc.caseId) {
    const assignees = await prisma.caseAssignee.findMany({
      where: { caseId: doc.caseId },
      select: { userId: true },
    });
    await requireCaseAccess(session, doc.caseId, assignees.map((a) => a.userId));
  }
  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  // Object retained (recycle bin); a PDPL purge path removes it separately.
  await logAudit({ session, action: "document.delete", resource: "documents", targetId: id });
}
