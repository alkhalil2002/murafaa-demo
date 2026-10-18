import { Injectable } from "@nestjs/common";
import {
  ErrorCode,
  type Office,
  type OfficeBrandingDto,
  type officeTaxProfile,
} from "@murafaa/contracts";
import type { z } from "zod";
import { resolveBranding } from "@murafaa/documents";
import { offices } from "@murafaa/database";
import { eq, isNull } from "drizzle-orm";
import { writeAudit } from "../../common/audit/audit.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { ApiException } from "../../common/http/api.exception.js";
import { TenantDb } from "../../database/tenant-db.service.js";

@Injectable()
export class OfficesService {
  constructor(private readonly tenantDb: TenantDb) {}

  /** The caller's office. RLS guarantees no other office row is visible. */
  async current(): Promise<Office> {
    const [row] = await this.tenantDb.run((tx) =>
      tx.select().from(offices).where(isNull(offices.deletedAt)).limit(1),
    );
    if (!row) throw new ApiException(ErrorCode.NOT_FOUND);
    return { id: row.id, name: row.name, createdAt: row.createdAt.toISOString() };
  }

  /** Letterhead branding merged over the defaults (legacy getOfficeBranding). */
  async branding(): Promise<OfficeBrandingDto> {
    const [row] = await this.tenantDb.run((tx) =>
      tx.select({ name: offices.name, branding: offices.branding }).from(offices).limit(1),
    );
    if (!row) throw new ApiException(ErrorCode.NOT_FOUND);
    const { logoStorageKey: _logo, ...branding } = resolveBranding(
      row.branding ?? { name: row.name },
    );
    return branding;
  }

  /** Update branding and the office name together (partner only, enforced by the controller). */
  async updateBranding(
    p: Principal,
    input: OfficeBrandingDto,
    meta: { ip: string; requestId: string },
  ) {
    await this.tenantDb.run(async (tx) => {
      const [row] = await tx
        .select({ branding: offices.branding })
        .from(offices)
        .where(eq(offices.id, p.officeId));
      const merged = { ...resolveBranding(row?.branding), ...input };
      await tx
        .update(offices)
        .set({ name: input.name, branding: merged, updatedBy: p.userId })
        .where(eq(offices.id, p.officeId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "office.branding.update",
        entity: "offices",
        entityId: p.officeId,
        ...meta,
      });
    });
    return this.branding();
  }

  /** The ZATCA tax profile (VAT and CR numbers, national address). */
  async taxProfile(): Promise<z.infer<typeof officeTaxProfile>> {
    const [row] = await this.tenantDb.run((tx) =>
      tx
        .select({
          vatNumber: offices.vatNumber,
          crNumber: offices.crNumber,
          taxAddress: offices.taxAddress,
        })
        .from(offices)
        .limit(1),
    );
    if (!row) throw new ApiException(ErrorCode.NOT_FOUND);
    return row;
  }

  async updateTaxProfile(
    p: Principal,
    input: z.infer<typeof officeTaxProfile>,
    meta: { ip: string; requestId: string },
  ) {
    await this.tenantDb.run(async (tx) => {
      await tx
        .update(offices)
        .set({ ...input, updatedBy: p.userId })
        .where(eq(offices.id, p.officeId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "office.tax.update",
        entity: "offices",
        entityId: p.officeId,
        after: input,
        ...meta,
      });
    });
    return this.taxProfile();
  }
}
