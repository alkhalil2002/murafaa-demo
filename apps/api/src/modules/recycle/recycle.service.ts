import { Injectable } from "@nestjs/common";
import {
  canModule,
  effectiveRole,
  type OfficePolicy,
  PermModule,
  type PermAction,
} from "@murafaa/auth";
import { ErrorCode } from "@murafaa/contracts";
import { cases, documents, leads, type Tx } from "@murafaa/database";
import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import { PolicyService } from "../../common/permissions/policy.service.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { caseVisibility } from "../cases/case-scope.js";

export type RecycleKind = "case" | "lead" | "document" | "employee";
type Item = { kind: RecycleKind; id: string; label: string; deletedAt: Date };

type Who = { p: Principal; policy: OfficePolicy };

/** Documents of cases outside the caller's row scope stay hidden, deleted or not. */
const docScope = (tx: Tx, { p, policy }: Who) =>
  or(
    isNull(documents.caseId),
    inArray(
      documents.caseId,
      tx
        .select({ id: cases.id })
        .from(cases)
        .where(caseVisibility(tx, policy, p)),
    ),
  );

/** One soft-deletable record type. Modules add theirs as they are rebuilt. */
type Source = {
  kind: RecycleKind;
  module: PermModule;
  list: (tx: Tx, who: Who) => Promise<Item[]>;
  restore: (tx: Tx, id: string, who: Who) => Promise<boolean>;
};

const SOURCES: Source[] = [
  {
    kind: "lead",
    module: PermModule.CLIENTS,
    // Converted leads are archived by conversion, not deleted, so they never appear here.
    list: async (tx) =>
      (
        await tx
          .select({ id: leads.id, label: leads.name, deletedAt: leads.deletedAt })
          .from(leads)
          .where(and(isNotNull(leads.deletedAt), isNull(leads.convertedClientId)))
          .orderBy(desc(leads.deletedAt))
      ).map((r) => ({ kind: "lead" as const, id: r.id, label: r.label, deletedAt: r.deletedAt! })),
    restore: async (tx, id, { p }) =>
      (
        await tx
          .update(leads)
          .set({ deletedAt: null, updatedBy: p.userId })
          .where(and(eq(leads.id, id), isNotNull(leads.deletedAt), isNull(leads.convertedClientId)))
          .returning({ id: leads.id })
      ).length === 1,
  },
  {
    kind: "document",
    module: PermModule.DOCUMENTS,
    list: async (tx, who) =>
      (
        await tx
          .select({ id: documents.id, label: documents.fileName, deletedAt: documents.deletedAt })
          .from(documents)
          .where(and(isNotNull(documents.deletedAt), docScope(tx, who)))
          .orderBy(desc(documents.deletedAt))
      ).map((r) => ({
        kind: "document" as const,
        id: r.id,
        label: r.label,
        deletedAt: r.deletedAt!,
      })),
    restore: async (tx, id, who) =>
      (
        await tx
          .update(documents)
          .set({ deletedAt: null, updatedBy: who.p.userId })
          .where(and(eq(documents.id, id), isNotNull(documents.deletedAt), docScope(tx, who)))
          .returning({ id: documents.id })
      ).length === 1,
  },
];

/**
 * Recycle bin (legacy settings): soft-deleted records, each kind shown only
 * to roles that can view its module (legacy showed every kind to everyone).
 * Restore needs edit on that module. Purge is partner-only and needs a
 * hard-delete path; it is added with the first module that requires it.
 */
@Injectable()
export class RecycleService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly policies: PolicyService,
  ) {}

  private async allowed(p: Principal, action: PermAction) {
    const policy = await this.policies.forOffice(p.officeId);
    return {
      who: { p, policy },
      sources: SOURCES.filter((s) => canModule(policy, effectiveRole(p), s.module, action)),
    };
  }

  async list(p: Principal) {
    const { who, sources } = await this.allowed(p, "view");
    const items = await this.tenantDb.run(async (tx) =>
      (await Promise.all(sources.map((s) => s.list(tx, who)))).flat(),
    );
    return items
      .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime())
      .map((i) => ({ ...i, deletedAt: i.deletedAt.toISOString() }));
  }

  async restore(
    p: Principal,
    kind: RecycleKind,
    id: string,
    meta: { ip: string; requestId: string },
  ) {
    const { who, sources } = await this.allowed(p, "edit");
    const source = sources.find((s) => s.kind === kind);
    if (!source) throw new ApiException(ErrorCode.FORBIDDEN);
    await this.tenantDb.run(async (tx) => {
      if (!(await source.restore(tx, id, who))) throw new ApiException(ErrorCode.NOT_FOUND);
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "recycle.restore",
        entity: kind,
        entityId: id,
        ...meta,
      });
    });
  }
}
