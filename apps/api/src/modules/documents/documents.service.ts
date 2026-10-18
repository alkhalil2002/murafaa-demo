import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { OfficePolicy } from "@murafaa/auth";
import { ErrorCode, type uploadDocumentQuery } from "@murafaa/contracts";
import { cases, documents, hearings, procedureRequests, type Tx } from "@murafaa/database";
import { contentMatchesMime, docKindForMime, uploadRejection } from "@murafaa/documents";
import { and, count, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { containsPattern } from "../../common/db/like.js";
import { ApiException } from "../../common/http/api.exception.js";
import {
  DOCUMENT_STORAGE,
  type DocumentStorage,
  documentKey,
} from "../../common/storage/storage.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { CaseAccess, type Meta } from "../cases/case-access.service.js";
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
