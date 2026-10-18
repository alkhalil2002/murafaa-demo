import { Injectable } from "@nestjs/common";
import {
  ALL_MODULES,
  ALL_ROLES,
  CaseScope,
  PermLevel,
  Role,
  wouldStrandLastPartner,
} from "@murafaa/auth";
import { ErrorCode } from "@murafaa/contracts";
import { auditLog, permissions, roleCaseScopes, sessions, users } from "@murafaa/database";
import { and, asc, desc, eq, isNull, like, or } from "drizzle-orm";
import { describeAudit, writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import { PolicyService } from "../../common/permissions/policy.service.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";

type Meta = { ip: string; requestId: string };

/** Audit prefixes shown in the security log (legacy security-audit.ts). */
const SECURITY_ACTION_PREFIXES = [
  "auth.",
  "portal.login",
  "portal.otp",
  "security.",
  "permission.",
  "access.",
];

/**
 * الصلاحيات admin (legacy permissions-admin.ts): edits the office's own policy
 * rows, which the guard reads on every request, so a change applies at once
 * on every instance. Partner-only (enforced by the controller).
 */
@Injectable()
export class PermissionsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly policies: PolicyService,
  ) {}

  async matrix(officeId: string) {
    const policy = await this.policies.forOffice(officeId);
    return ALL_ROLES.map((role) => ({
      role,
      levels: Object.fromEntries(
        ALL_MODULES.map((m) => [m, policy.modules[role]?.[m] ?? PermLevel.NONE]),
      ) as Record<(typeof ALL_MODULES)[number], PermLevel>,
      caseScope: policy.caseScope[role] ?? CaseScope.ASSIGNED,
    }));
  }

  setModuleLevel(
    p: Principal,
    input: { role: Role; module: (typeof ALL_MODULES)[number]; level: PermLevel },
    meta: Meta,
  ) {
    return this.tenantDb.run(async (tx) => {
      await tx
        .insert(permissions)
        .values({ officeId: p.officeId, ...input, createdBy: p.userId })
        .onConflictDoUpdate({
          target: [permissions.officeId, permissions.role, permissions.module],
          set: { level: input.level, updatedBy: p.userId, updatedAt: new Date() },
        });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "permission.setLevel",
        entity: "permissions",
        after: input,
        ...meta,
      });
    });
  }

  setCaseScope(p: Principal, input: { role: Role; scope: CaseScope }, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      await tx
        .insert(roleCaseScopes)
        .values({ officeId: p.officeId, ...input, createdBy: p.userId })
        .onConflictDoUpdate({
          target: [roleCaseScopes.officeId, roleCaseScopes.role],
          set: { scope: input.scope, updatedBy: p.userId, updatedAt: new Date() },
        });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "permission.setCaseScope",
        entity: "permissions",
        after: input,
        ...meta,
      });
    });
  }

  users() {
    return this.tenantDb.run((tx) =>
      tx
        .select({ id: users.id, name: users.name, role: users.role })
        .from(users)
        .where(isNull(users.deletedAt))
        .orderBy(asc(users.name)),
    );
  }

  /** Change a user's role; the office can never be left without a partner. */
  setUserRole(p: Principal, userId: string, role: Role, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [target] = await tx
        .select({ role: users.role })
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .for("update");
      if (!target) throw new ApiException(ErrorCode.NOT_FOUND);

      if (target.role === Role.PARTNER && role !== Role.PARTNER) {
        // Lock the partner rows so two concurrent demotions can't both pass the count.
        const partners = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.role, Role.PARTNER), isNull(users.deletedAt)))
          .for("update");
        if (wouldStrandLastPartner(target.role, role, partners.length)) {
          throw new ApiException(ErrorCode.CONFLICT, undefined, "errors.LAST_PARTNER");
        }
      }
      await tx.update(users).set({ role, updatedBy: p.userId }).where(eq(users.id, userId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "permission.setUserRole",
        entity: "users",
        entityId: userId,
        after: { from: target.role, to: role },
        ...meta,
      });
    });
  }

  /** Logins, permission and security changes, newest first (legacy security-audit.ts). */
  async securityAudit(take = 100) {
    const rows = await this.tenantDb.run((tx) =>
      tx
        .select({
          id: auditLog.id,
          action: auditLog.action,
          after: auditLog.after,
          actorName: users.name,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.actorId))
        .where(or(...SECURITY_ACTION_PREFIXES.map((prefix) => like(auditLog.action, `${prefix}%`))))
        .orderBy(desc(auditLog.createdAt))
        .limit(take),
    );
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      detail: describeAudit(r.after),
      actorName: r.actorName,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Start or end role preview on the caller's own session (view-only while active). */
  setPreview(p: Principal, sessionId: string, role: Role | null, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      await tx
        .update(sessions)
        .set({ previewRole: role, updatedBy: p.userId })
        .where(and(eq(sessions.id, sessionId), eq(sessions.userId, p.userId)));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: role ? "permission.preview.start" : "permission.preview.end",
        entity: "sessions",
        entityId: sessionId,
        after: role ? { role } : undefined,
        ...meta,
      });
    });
  }
}
