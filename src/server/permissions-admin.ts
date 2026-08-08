import { CaseScope, PermLevel, PermModule, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { logAudit } from "@/lib/audit";
import { invalidateOfficePolicy } from "@/lib/permissions/policy";
import { ALL_MODULES, ALL_ROLES } from "@/lib/permissions/matrix";

/**
 * الصلاحيات admin (docs/04): edits the office's own Permission /
 * RoleCaseScope rows — the same tables loadOfficePolicy() reads for every
 * server-side check. Partner-only: this IS the module-access matrix, so it
 * cannot gate itself with PermModule.PERMISSIONS the way other modules do
 * (a role could otherwise revoke its own admin access and lock the office
 * out — the prototype has the same partner-only implication via "شريك" being
 * the undeletable owner role).
 */

function assertPartner(session: AppSession): void {
  if (session.role !== Role.PARTNER) throw new Error("PARTNER_ONLY");
}

export type RoleMatrixRow = {
  role: Role;
  levels: Partial<Record<PermModule, PermLevel>>;
  caseScope: CaseScope;
};

export async function getRoleMatrix(session: AppSession): Promise<RoleMatrixRow[]> {
  assertPartner(session);
  const [permissions, scopes] = await Promise.all([
    prisma.permission.findMany({ where: { officeId: session.officeId } }),
    prisma.roleCaseScope.findMany({ where: { officeId: session.officeId } }),
  ]);

  return ALL_ROLES.map((role) => {
    const levels: Partial<Record<PermModule, PermLevel>> = {};
    for (const p of permissions.filter((p) => p.role === role)) levels[p.module] = p.level;
    const scope = scopes.find((s) => s.role === role)?.scope ?? CaseScope.ASSIGNED;
    return { role, levels, caseScope: scope };
  });
}

const LEVEL_VALUES = [PermLevel.NONE, PermLevel.VIEW, PermLevel.EDIT, PermLevel.FULL];

const setLevelSchema = z.object({
  role: z.nativeEnum(Role),
  module: z.nativeEnum(PermModule),
  level: z.nativeEnum(PermLevel),
});

export async function setModuleLevel(session: AppSession, raw: z.infer<typeof setLevelSchema>) {
  assertPartner(session);
  const input = setLevelSchema.parse(raw);
  if (!ALL_MODULES.includes(input.module)) throw new Error("UNKNOWN_MODULE");
  await prisma.permission.upsert({
    where: { officeId_role_module: { officeId: session.officeId, role: input.role, module: input.module } },
    create: { officeId: session.officeId, role: input.role, module: input.module, level: input.level },
    update: { level: input.level },
  });
  invalidateOfficePolicy(session.officeId);
  await logAudit({
    session,
    action: "permission.setLevel",
    resource: "permissions",
    detail: `${input.role}:${input.module} → ${input.level}`,
  });
}

const setScopeSchema = z.object({ role: z.nativeEnum(Role), scope: z.nativeEnum(CaseScope) });

export async function setRoleCaseScope(session: AppSession, raw: z.infer<typeof setScopeSchema>) {
  assertPartner(session);
  const input = setScopeSchema.parse(raw);
  await prisma.roleCaseScope.upsert({
    where: { officeId_role: { officeId: session.officeId, role: input.role } },
    create: { officeId: session.officeId, role: input.role, scope: input.scope },
    update: { scope: input.scope },
  });
  invalidateOfficePolicy(session.officeId);
  await logAudit({
    session,
    action: "permission.setCaseScope",
    resource: "permissions",
    detail: `${input.role} → ${input.scope}`,
  });
}

export type UserRoleRow = { id: string; name: string; role: Role };

export async function listUsersWithRoles(session: AppSession): Promise<UserRoleRow[]> {
  assertPartner(session);
  return prisma.user.findMany({
    where: { officeId: session.officeId },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}

const setUserRoleSchema = z.object({ userId: z.string().uuid(), role: z.nativeEnum(Role) });

export async function setUserRole(session: AppSession, raw: z.infer<typeof setUserRoleSchema>) {
  assertPartner(session);
  const input = setUserRoleSchema.parse(raw);
  const target = await prisma.user.findFirstOrThrow({
    where: { id: input.userId, officeId: session.officeId },
  });
  // The last PARTNER in an office can't be demoted — would strand the office
  // with no one able to manage this very screen.
  if (target.role === Role.PARTNER && input.role !== Role.PARTNER) {
    const partnerCount = await prisma.user.count({ where: { officeId: session.officeId, role: Role.PARTNER } });
    if (partnerCount <= 1) throw new Error("LAST_PARTNER");
  }
  await prisma.user.update({ where: { id: input.userId }, data: { role: input.role } });
  await logAudit({
    session,
    action: "permission.setUserRole",
    resource: "users",
    targetId: input.userId,
    detail: `${target.role} → ${input.role}`,
  });
}

export { LEVEL_VALUES };
