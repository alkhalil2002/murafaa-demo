import { Inject, Injectable } from "@nestjs/common";
import { ErrorCode } from "@murafaa/contracts";
import { type Db, type Tx, withTenant } from "@murafaa/database";
import { ApiException } from "../common/http/api.exception.js";
import { tenantContext } from "../common/tenancy/tenant-context.js";
import { DB } from "./database.tokens.js";

/**
 * The only way services touch tenant data: every call runs in a transaction
 * scoped to the caller's office, and Postgres RLS enforces it. No principal →
 * no query (fails closed).
 */
@Injectable()
export class TenantDb {
  constructor(@Inject(DB) private readonly db: Db) {}

  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    const principal = tenantContext.getStore();
    if (!principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
    return withTenant(this.db, principal.officeId, fn);
  }
}
