import {
  bigint,
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { audit, id, tenantPolicy, timestamps } from "./_helpers.js";
import { cases } from "./cases.js";
import { docPartyEnum, hearings, procedureRequests } from "./hearings.js";
import { offices } from "./offices.js";
import { users } from "./users.js";

/** Values match @murafaa/documents. */
export const docKindEnum = pgEnum("doc_kind", ["DOCUMENT", "IMAGE", "TEXT", "FILE", "LETTER"]);
export const docSourceEnum = pgEnum("doc_source", [
  "OPENING",
  "PROCEDURAL_REQUEST",
  "HEARING",
  "CLIENT",
  "TEMPLATE",
  "UPLOAD",
]);
export const procedureDocRoleEnum = pgEnum("procedure_doc_role", ["REQUEST", "RESULT"]);

/**
 * Document metadata; the bytes live in object storage under `storage_key`.
 * Template documents keep their field values and rendered HTML, and a frozen
 * generated date (re-rendering never changes it).
 */
export const documents = pgTable(
  "documents",
  {
    id,
    officeId: uuid("office_id")
      .notNull()
      .references(() => offices.id),
    /** Null for a document generated outside any case. */
    caseId: uuid("case_id").references(() => cases.id),
    fileName: text("file_name").notNull(),
    kind: docKindEnum("kind").notNull().default("DOCUMENT"),
    source: docSourceEnum("source").notNull(),
    party: docPartyEnum("party"),
    /** Free descriptor (صحيفة/محضر/مذكرة…). */
    docType: text("doc_type"),
    sessionLabel: text("session_label"),
    hearingId: uuid("hearing_id").references(() => hearings.id),
    procedureRequestId: uuid("procedure_request_id").references(() => procedureRequests.id),
    procedureDocRole: procedureDocRoleEnum("procedure_doc_role"),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256").notNull(),
    templateKey: text("template_key"),
    fieldValues: jsonb("field_values").$type<Record<string, string>>(),
    renderedHtml: text("rendered_html"),
    generatedDate: timestamp("generated_date", { withTimezone: true }),
    /** Images wait for text extraction (knowledge-base seam, M5). */
    needsOcr: boolean("needs_ocr").notNull().default(false),
    extractedText: text("extracted_text"),
    /** Shared on the client portal (the portal itself arrives with M8). */
    clientVisible: boolean("client_visible").notNull().default(false),
    fromClient: boolean("from_client").notNull().default(false),
    clientSharedAt: timestamp("client_shared_at", { withTimezone: true }),
    clientSharedBy: uuid("client_shared_by").references(() => users.id),
    ...timestamps,
    ...audit,
  },
  (t) => [
    index("documents_case_idx").on(t.officeId, t.caseId),
    index("documents_source_idx").on(t.officeId, t.source),
    tenantPolicy(),
  ],
).enableRLS();
