import { Inject, Injectable } from "@nestjs/common";
import {
  type CaseScope,
  type OfficePolicy,
  type PermLevel,
  type PermModule,
  policyFromRows,
  type Role,
} from "@murafaa/auth";
import {
  type Db,
  fieldPermissions,
  permissions,
  roleCaseScopes,
  withTenant,
} from "@murafaa/database";
import { isNull } from "drizzle-orm";
import { DB } from "../../database/database.tokens.js";

/**
 * An office's permission policy, read from its own editable rows on every
 * call. No process-wide cache: on several Cloud Run instances a cached copy
 * would keep enforcing an old matrix after a partner changes it (a legacy
 * defect). The three lookups are small, indexed and office-scoped.
 */
@Injectable()
export class PolicyService {
  constructor(@Inject(DB) private readonly db: Db) {}

  forOffice(officeId: string): Promise<OfficePolicy> {
    return withTenant(this.db, officeId, async (tx) => {
      const modules = await tx
        .select({ role: permissions.role, module: permissions.module, level: permissions.level })
        .from(permissions)
        .where(isNull(permissions.deletedAt));
      const fields = await tx
        .select({
          role: fieldPermissions.role,
          resource: fieldPermissions.resource,
          field: fieldPermissions.field,
        })
        .from(fieldPermissions)
        .where(isNull(fieldPermissions.deletedAt));
      const scopes = await tx
        .select({ role: roleCaseScopes.role, scope: roleCaseScopes.scope })
        .from(roleCaseScopes)
        .where(isNull(roleCaseScopes.deletedAt));
      return policyFromRows(
        modules as Array<{ role: Role; module: PermModule; level: PermLevel }>,
        fields as Array<{ role: Role; resource: string; field: string }>,
        scopes as Array<{ role: Role; scope: CaseScope }>,
      );
    });
  }
}
