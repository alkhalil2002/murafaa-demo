import { Controller, Get, Injectable } from "@nestjs/common";
import { billingUsage, ErrorCode } from "@murafaa/contracts";
import { offices, users } from "@murafaa/database";
import { and, count, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { RequirePartner } from "../../common/permissions/permission.decorators.js";
import { ZodResponse } from "../../common/zod/zod.decorators.js";
import { TenantDb } from "../../database/tenant-db.service.js";

@Injectable()
export class BillingService {
  constructor(private readonly tenantDb: TenantDb) {}

  /** Usage summary (legacy getBillingUsage). Case/client/document counts join as those modules land. */
  usage(): Promise<z.infer<typeof billingUsage>> {
    return this.tenantDb.run(async (tx) => {
      const [office] = await tx.select({ createdAt: offices.createdAt }).from(offices).limit(1);
      if (!office) throw new ApiException(ErrorCode.NOT_FOUND);
      const [seats] = await tx
        .select({ n: count() })
        .from(users)
        .where(and(eq(users.isActive, true), isNull(users.deletedAt)));
      return {
        seats: seats?.n ?? 0,
        cases: 0,
        clients: 0,
        documents: 0,
        memberSince: office.createdAt.toISOString(),
      };
    });
  }
}

/** الباقات: partner only (legacy billing-usage). */
@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @RequirePartner("billing.view")
  @Get("usage")
  @ZodResponse(billingUsage)
  usage() {
    return this.billing.usage();
  }
}
