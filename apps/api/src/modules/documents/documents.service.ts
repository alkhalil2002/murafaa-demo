import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { canField, effectiveRole, type OfficePolicy } from "@murafaa/auth";
import { ErrorCode, type generateDocumentBody, type uploadDocumentQuery } from "@murafaa/contracts";
import { cases, documents, hearings, procedureRequests, type Tx } from "@murafaa/database";
import {
  contentMatchesMime,
  docKindForMime,
  formatHijri,
  letterheadHtml,
  prepareFields,
  renderBody,
  resolveBranding,
  TEMPLATE_DEFS,
  textToBodyHtml,
  uploadRejection,
} from "@murafaa/documents";
import { t } from "@murafaa/i18n";
import { and, count, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { containsPattern } from "../../common/db/like.js";
import { ApiException } from "../../common/http/api.exception.js";
import { PolicyService } from "../../common/permissions/policy.service.js";
import { PdfClient } from "../../common/pdf/pdf.client.js";
import {
  DOCUMENT_STORAGE,
  type DocumentStorage,
  documentKey,
} from "../../common/storage/storage.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { caseAutofill } from "../cases/case-autofill.js";
import { CaseAccess, type Meta } from "../cases/case-access.service.js";
import { OfficesService } from "../offices/offices.service.js";
import { logCaseEvent } from "../cases/case-events.js";
import { caseVisibility } from "../cases/case-scope.js";

type DocRow = typeof documents.$inferSelect;
const invalid = (messageKey: string, path?: string) =>
  new ApiException(
    ErrorCode.VALIDATION_FAILED,
    path ? [{ path, message: "errors.NOT_FOUND" }] : undefined,
    messageKey,
  );

const REJECTION_KEY = {
  type: "errors.UPLOAD_TYPE",
  size: "errors.UPLOAD_TOO_LARGE",
  empty: "errors.UPLOAD_EMPTY",
} as const;

export function toItem(d: DocRow) {
  return {
    id: d.id,
    fileName: d.fileName,
    kind: d.kind,
    source: d.source,
    party: d.party,
    docType: d.docType,
    sessionLabel: d.sessionLabel,
    hearingId: d.hearingId,
    procedureRequestId: d.procedureRequestId,
    procedureDocRole: d.procedureDocRole,
    mimeType: d.mimeType,
    sizeBytes: d.sizeBytes,
    templateKey: d.templateKey,
    needsOcr: d.needsOcr,
    extractedText: d.extractedText,
    clientVisible: d.clientVisible,
    createdAt: d.createdAt.toISOString(),
  };
}

/**
 * المستندات (legacy server/documents.ts): uploads, listing, audited
 * download, client sharing, soft delete. Module DOCUMENTS (route level) +
 * the case row scope. Bytes live in object storage; the row holds the
 * metadata, the key and a SHA-256 of the content.
 */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly access: CaseAccess,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
    private readonly policies: PolicyService,
    private readonly offices: OfficesService,
    private readonly pdf: PdfClient,
  ) {}

  list(p: Principal, caseId: string, meta: Meta) {
    return this.access.withCase(p, caseId, meta, async (tx) => {
      const rows = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.caseId, caseId), isNull(documents.deletedAt)))
        .orderBy(desc(documents.createdAt));
      return rows.map(toItem);
    });
  }

  async upload(
    p: Principal,
    caseId: string,
    q: z.infer<typeof uploadDocumentQuery>,
    bytes: Buffer,
    meta: Meta,
  ) {
    const rejected = uploadRejection({ mime: q.mimeType, bytes: bytes.length }, "staff");
    if (rejected) throw invalid(REJECTION_KEY[rejected]);
    if (!contentMatchesMime(bytes, q.mimeType)) throw invalid("errors.UPLOAD_CONTENT_MISMATCH");

    const id = randomUUID();
    const storageKey = documentKey({
      officeId: p.officeId,
      caseId,
      documentId: id,
      fileName: q.fileName,
    });
    let stored = false;
    try {
      return await this.access.withCase(p, caseId, meta, async (tx) => {
        if (q.hearingId) {
          const [h] = await tx
            .select({ id: hearings.id })
            .from(hearings)
            .where(
              and(
                eq(hearings.id, q.hearingId),
                eq(hearings.caseId, caseId),
                isNull(hearings.deletedAt),
              ),
            );
          if (!h) throw invalid("errors.VALIDATION_FAILED", "hearingId");
        }
        if (q.procedureRequestId) {
          const [r] = await tx
            .select({ id: procedureRequests.id })
            .from(procedureRequests)
            .where(
              and(
                eq(procedureRequests.id, q.procedureRequestId),
                eq(procedureRequests.caseId, caseId),
                isNull(procedureRequests.deletedAt),
              ),
            );
          if (!r) throw invalid("errors.VALIDATION_FAILED", "procedureRequestId");
        }
        await this.storage.put(storageKey, bytes, q.mimeType);
        stored = true;
        const [doc] = await tx
          .insert(documents)
          .values({
            id,
            officeId: p.officeId,
            caseId,
            fileName: q.fileName,
            kind: docKindForMime(q.mimeType),
            source: q.source,
            party: q.party ?? null,
            docType: q.docType,
            sessionLabel: q.sessionLabel,
            hearingId: q.hearingId ?? null,
            procedureRequestId: q.procedureRequestId ?? null,
            procedureDocRole: q.procedureRequestId ? (q.procedureDocRole ?? "REQUEST") : null,
            storageKey,
            mimeType: q.mimeType,
            sizeBytes: bytes.length,
            sha256: createHash("sha256").update(bytes).digest("hex"),
            needsOcr: q.mimeType.startsWith("image/"),
            createdBy: p.userId,
          })
          .returning();
        await logCaseEvent(tx, {
          officeId: p.officeId,
          caseId,
          type: "DOC",
          actorUserId: p.userId,
          messageKey: "event.docUploaded",
          params: { name: q.fileName },
        });
        await writeAudit(tx, {
          officeId: p.officeId,
          actorId: p.userId,
          action: "document.upload",
          entity: "documents",
          entityId: id,
          after: { caseId },
          ...meta,
        });
        return toItem(doc!);
      });
    } catch (e) {
      // The row never committed: drop the orphaned object.
      if (stored) await this.storage.delete(storageKey).catch(() => undefined);
      throw e;
    }
  }

  /**
   * Run `fn` on a live document the caller may reach: its case must be in
   * the caller's row scope; a document outside any case needs only the module.
   */
  private async withDocument<T>(
    p: Principal,
    id: string,
    meta: Meta,
    fn: (tx: Tx, d: DocRow) => Promise<T>,
  ) {
    const [head] = await this.tenantDb.run((tx) =>
      tx
        .select({ caseId: documents.caseId })
        .from(documents)
        .where(and(eq(documents.id, id), isNull(documents.deletedAt))),
    );
    if (!head) throw new ApiException(ErrorCode.NOT_FOUND);
    const inTx = async (tx: Tx) => {
      const [d] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), isNull(documents.deletedAt)));
      if (!d) throw new ApiException(ErrorCode.NOT_FOUND);
      return fn(tx, d);
    };
    return head.caseId ? this.access.withCase(p, head.caseId, meta, inTx) : this.tenantDb.run(inTx);
  }

  /** The bytes for an authorized download; every download is audited. */
  async download(p: Principal, id: string, meta: Meta) {
    const d = await this.withDocument(p, id, meta, async (tx, doc) => {
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "document.download",
        entity: "documents",
        entityId: id,
        ...meta,
      });
      return doc;
    });
    return {
      fileName: d.fileName,
      mimeType: d.mimeType,
      bytes: await this.storage.get(d.storageKey),
    };
  }

  /** Share with / hide from the client portal (the portal itself is M8). */
  async toggleShare(p: Principal, id: string, meta: Meta) {
    return this.withDocument(p, id, meta, async (tx, d) => {
      const visible = !d.clientVisible;
      await tx
        .update(documents)
        .set({
          clientVisible: visible,
          clientSharedAt: visible ? new Date() : null,
          clientSharedBy: visible ? p.userId : null,
          updatedBy: p.userId,
        })
        .where(eq(documents.id, id));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: visible ? "document.share" : "document.unshare",
        entity: "documents",
        entityId: id,
        ...meta,
      });
    });
  }

  /** Soft delete into the recycle bin; the stored object is kept. */
  async remove(p: Principal, id: string, meta: Meta) {
    return this.withDocument(p, id, meta, async (tx) => {
      await tx
        .update(documents)
        .set({ deletedAt: new Date(), updatedBy: p.userId })
        .where(eq(documents.id, id));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "document.delete",
        entity: "documents",
        entityId: id,
        ...meta,
      });
    });
  }

  /** Remove every opening-package document of a case at once (prototype "تفريغ الحزمة"). */
  clearOpening(p: Principal, caseId: string, meta: Meta) {
    return this.access.withCase(p, caseId, meta, async (tx) => {
      const done = await tx
        .update(documents)
        .set({ deletedAt: new Date(), updatedBy: p.userId })
        .where(
          and(
            eq(documents.caseId, caseId),
            eq(documents.source, "OPENING"),
            isNull(documents.deletedAt),
          ),
        )
        .returning({ id: documents.id });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "document.clearOpeningPackage",
        entity: "cases",
        entityId: caseId,
        after: { count: done.length },
        ...meta,
      });
      return { count: done.length };
    });
  }

  // ── Templates and generated documents (legacy templates.ts, generateFromTemplate) ──

  /** The system templates (seed data in @murafaa/documents). */
  listTemplates() {
    return TEMPLATE_DEFS.map((d) => ({ key: d.key, title: d.title, category: d.category }));
  }

  private template(key: string) {
    const def = TEMPLATE_DEFS.find((d) => d.key === key);
    if (!def) throw new ApiException(ErrorCode.NOT_FOUND, undefined, "errors.TEMPLATE_NOT_FOUND");
    return def;
  }

  /** Field-deny (docs/04 layer 2): roles denied the case fees field never see or submit fee fields. */
  private async feesDenied(p: Principal) {
    const policy = await this.policies.forOffice(p.officeId);
    return !canField(policy, effectiveRole(p), "cases", "fees");
  }

  /** The case values a template may prefill, read inside the caller's row scope. */
  private caseData(p: Principal, caseId: string | null | undefined, meta: Meta) {
    if (!caseId) return Promise.resolve(null);
    return this.access.withCase(p, caseId, meta, async (tx, c) => ({
      title: c.title,
      autofill: await caseAutofill(tx, c),
    }));
  }

  /** The generate form: fields the caller may fill, prefilled from the case. */
  async templateForm(p: Principal, key: string, caseId: string | undefined, meta: Meta) {
    const def = this.template(key);
    const kase = await this.caseData(p, caseId, meta);
    const { fields, values } = prepareFields(def.fields, kase?.autofill ?? null, {
      feesDenied: await this.feesDenied(p),
    });
    return {
      template: { key: def.key, title: def.title },
      fields: fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        ...(f.options ? { options: f.options } : {}),
      })),
      values,
      caseId: caseId ?? null,
      caseTitle: kase?.title ?? null,
    };
  }

  private async letterhead(title: string, bodyHtml: string, at: Date) {
    const branding = resolveBranding(await this.offices.branding());
    return letterheadHtml({
      branding,
      title,
      bodyHtml,
      labels: {
        date: t("letterhead.date", { date: formatHijri(at) }),
        onBehalfOf: t("letterhead.onBehalfOf", { name: branding.name }),
        signature: t("letterhead.signature"),
      },
    });
  }

  /** Render, store and record a PDF; the object is removed again if the row does not commit. */
  private async storePdf(
    p: Principal,
    caseId: string | null,
    fileName: string,
    pdf: Buffer,
    row: Partial<typeof documents.$inferInsert> & { source: DocRow["source"] },
    inTx: (run: (tx: Tx) => Promise<DocRow>) => Promise<DocRow>,
    after: (tx: Tx, d: DocRow) => Promise<void>,
  ) {
    const id = randomUUID();
    const storageKey = documentKey({ officeId: p.officeId, caseId, documentId: id, fileName });
    await this.storage.put(storageKey, pdf, "application/pdf");
    try {
      return await inTx(async (tx) => {
        const [d] = await tx
          .insert(documents)
          .values({
            id,
            officeId: p.officeId,
            caseId,
            fileName,
            kind: "LETTER",
            storageKey,
            mimeType: "application/pdf",
            sizeBytes: pdf.length,
            sha256: createHash("sha256").update(pdf).digest("hex"),
            createdBy: p.userId,
            ...row,
          })
          .returning();
        await after(tx, d!);
        return d!;
      });
    } catch (e) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw e;
    }
  }

  /**
   * Generate a letterhead PDF from a template. Values for denied or unknown
   * fields are ignored; the Hijri document date is frozen on the row.
   */
  async generate(p: Principal, input: z.infer<typeof generateDocumentBody>, meta: Meta) {
    const def = this.template(input.templateKey);
    const caseId = input.caseId ?? null;
    const kase = await this.caseData(p, caseId, meta);
    const { fields, values: defaults } = prepareFields(def.fields, kase?.autofill ?? null, {
      feesDenied: await this.feesDenied(p),
    });
    const allowed = new Set(fields.map((f) => f.id));
    const values: Record<string, string> = { ...defaults };
    for (const [k, v] of Object.entries(input.values)) if (allowed.has(k)) values[k] = v;

    const at = new Date();
    const branding = resolveBranding(await this.offices.branding());
    const html = await this.letterhead(
      def.title,
      renderBody(def.bodyTemplate, values, branding.name),
      at,
    );
    const pdf = await this.pdf.render(html);
    const inTx = (run: (tx: Tx) => Promise<DocRow>) =>
      caseId ? this.access.withCase(p, caseId, meta, (tx) => run(tx)) : this.tenantDb.run(run);
    const doc = await this.storePdf(
      p,
      caseId,
      `${def.title}.pdf`,
      pdf,
      {
        source: "TEMPLATE",
        party: "OURS",
        docType: t("documents.generatedDocType"),
        templateKey: def.key,
        fieldValues: values,
        renderedHtml: html,
        generatedDate: at,
      },
      inTx,
      async (tx, d) => {
        if (caseId) {
          await logCaseEvent(tx, {
            officeId: p.officeId,
            caseId,
            type: "DOC",
            actorUserId: p.userId,
            messageKey: "event.docGenerated",
            params: { name: def.title },
          });
        }
        await writeAudit(tx, {
          officeId: p.officeId,
          actorId: p.userId,
          action: "document.generate",
          entity: "documents",
          entityId: d.id,
          after: { template: def.key },
          ...meta,
        });
      },
    );
    return toItem(doc);
  }

  /** A hearing's client report on the letterhead, kept as a case document (prototype "⬇ معاينة PDF بالديباجة"). */
  async hearingReportPdf(p: Principal, caseId: string, hearingId: string, meta: Meta) {
    const h = await this.access.withCase(p, caseId, meta, async (tx) => {
      const [row] = await tx
        .select({
          id: hearings.id,
          sequenceNo: hearings.sequenceNo,
          clientReport: hearings.clientReport,
        })
        .from(hearings)
        .where(
          and(eq(hearings.id, hearingId), eq(hearings.caseId, caseId), isNull(hearings.deletedAt)),
        );
      if (!row) throw new ApiException(ErrorCode.NOT_FOUND);
      if (!row.clientReport)
        throw new ApiException(ErrorCode.CONFLICT, undefined, "errors.HEARING_HAS_NO_REPORT");
      return row;
    });
    const at = new Date();
    const title = t("cases.hearings.clientReport");
    const html = await this.letterhead(title, textToBodyHtml(h.clientReport!), at);
    const pdf = await this.pdf.render(html);
    const session = t("cases.hearings.sessionNo", {
      no: (h.sequenceNo ?? 0).toLocaleString("ar-SA"),
    });
    const doc = await this.storePdf(
      p,
      caseId,
      `${session} - ${title}.pdf`,
      pdf,
      {
        source: "HEARING",
        docType: title,
        hearingId,
        sessionLabel: session,
        renderedHtml: html,
        generatedDate: at,
      },
      (run) => this.access.withCase(p, caseId, meta, (tx) => run(tx)),
      async (tx, d) => {
        await writeAudit(tx, {
          officeId: p.officeId,
          actorId: p.userId,
          action: "hearing.reportPdf",
          entity: "documents",
          entityId: d.id,
          after: { hearingId },
          ...meta,
        });
      },
    );
    return toItem(doc);
  }

  // ── Read models for search, billing and the recycle bin ──

  /** File name contains `q`; documents of out-of-scope cases stay hidden. */
  search(tx: Tx, policy: OfficePolicy, p: Principal, q: string, take: number) {
    const visibleCases = tx
      .select({ id: cases.id })
      .from(cases)
      .where(caseVisibility(tx, policy, p));
    return tx
      .select({ id: documents.id, fileName: documents.fileName, caseId: documents.caseId })
      .from(documents)
      .where(
        and(
          isNull(documents.deletedAt),
          ilike(documents.fileName, containsPattern(q)),
          or(isNull(documents.caseId), inArray(documents.caseId, visibleCases)),
        ),
      )
      .limit(take);
  }

  async liveCount(tx: Tx) {
    const [r] = await tx.select({ n: count() }).from(documents).where(isNull(documents.deletedAt));
    return r?.n ?? 0;
  }
}
