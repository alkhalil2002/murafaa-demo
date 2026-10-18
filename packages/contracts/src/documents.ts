import {
  DOC_KINDS,
  DOC_SOURCES,
  PROCEDURE_DOC_ROLES,
  STAFF_UPLOAD_SOURCES,
  UPLOAD_MIME_ALLOW,
} from "@murafaa/documents";
import { DOC_PARTIES } from "@murafaa/rules";
import { z } from "zod";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

/**
 * Upload metadata, sent as the query string; the request body is the file's
 * bytes (application/octet-stream). The declared type is checked against the
 * file content on the server.
 */
export const uploadDocumentQuery = z.object({
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum([...UPLOAD_MIME_ALLOW] as [string, ...string[]]),
  source: z.enum(STAFF_UPLOAD_SOURCES).default("UPLOAD"),
  party: z.enum(DOC_PARTIES).optional(),
  docType: optional(100),
  sessionLabel: optional(100),
  hearingId: z.uuid().optional(),
  procedureRequestId: z.uuid().optional(),
  procedureDocRole: z.enum(PROCEDURE_DOC_ROLES).optional(),
});

export const documentItem = z
  .object({
    id: z.uuid(),
    fileName: z.string(),
    kind: z.enum(DOC_KINDS),
    source: z.enum(DOC_SOURCES),
    party: z.enum(DOC_PARTIES).nullable(),
    docType: z.string().nullable(),
    sessionLabel: z.string().nullable(),
    hearingId: z.uuid().nullable(),
    procedureRequestId: z.uuid().nullable(),
    procedureDocRole: z.enum(PROCEDURE_DOC_ROLES).nullable(),
    mimeType: z.string(),
    sizeBytes: z.number().int(),
    templateKey: z.string().nullable(),
    needsOcr: z.boolean(),
    extractedText: z.string().nullable(),
    clientVisible: z.boolean(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "DocumentItem" });
export const documentList = z.array(documentItem).meta({ id: "DocumentList" });
export const clearedCount = z.object({ count: z.number().int() }).meta({ id: "ClearedCount" });

// ── Templates and generated documents ──

export const templateSummary = z
  .object({ key: z.string(), title: z.string(), category: z.string() })
  .meta({ id: "TemplateSummary" });
export const templateList = z.array(templateSummary).meta({ id: "TemplateList" });
export const templateKeyParams = z.object({ key: z.string().min(1).max(50) });
export const templateFormQuery = z.object({ caseId: z.uuid().optional() });
export const templateForm = z
  .object({
    template: z.object({ key: z.string(), title: z.string() }),
    fields: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        type: z.enum(["input", "textarea", "select"]),
        options: z.array(z.string()).optional(),
      }),
    ),
    values: z.record(z.string(), z.string()),
    caseId: z.uuid().nullable(),
    caseTitle: z.string().nullable(),
  })
  .meta({ id: "TemplateForm" });
export const generateDocumentBody = z
  .object({
    templateKey: z.string().min(1).max(50),
    caseId: z.uuid().nullish(),
    values: z.record(z.string().max(50), z.string().max(10_000)).default({}),
  })
  .meta({ id: "GenerateDocumentBody" });
