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
