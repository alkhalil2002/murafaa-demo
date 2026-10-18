import { Injectable } from "@nestjs/common";
import { ErrorCode, type Office } from "@murafaa/contracts";
import { offices } from "@murafaa/database";
import { isNull } from "drizzle-orm";
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
}
