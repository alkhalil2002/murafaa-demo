import { CaseScope } from "@murafaa/auth";
import { z } from "zod";
import { permLevel, permModule, role } from "./auth.js";

export const caseScope = z.enum(Object.values(CaseScope));

/** One role's row in the partner's permissions screen (docs/04 layers 1 and 3). */
export const roleMatrixRow = z
  .object({
    role,
    levels: z.record(permModule, permLevel),
    caseScope,
  })
  .meta({ id: "RoleMatrixRow" });
export const roleMatrix = z.array(roleMatrixRow).meta({ id: "RoleMatrix" });

export const setModuleLevelBody = z
  .object({ role, module: permModule, level: permLevel })
  .meta({ id: "SetModuleLevelBody" });
export const setCaseScopeBody = z
  .object({ role, scope: caseScope })
  .meta({ id: "SetCaseScopeBody" });

export const officeUser = z
  .object({ id: z.uuid(), name: z.string(), role })
  .meta({ id: "OfficeUser" });
export const officeUsers = z.array(officeUser).meta({ id: "OfficeUsers" });
export const userIdParams = z.object({ id: z.uuid() });
export const setUserRoleBody = z.object({ role }).meta({ id: "SetUserRoleBody" });

export const startPreviewBody = z.object({ role }).meta({ id: "StartPreviewBody" });

/** Security audit (logins, permission and security changes), newest first. */
export const securityAuditEntry = z
  .object({
    id: z.uuid(),
    action: z.string(),
    detail: z.string().nullable(),
    actorName: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "SecurityAuditEntry" });
export const securityAudit = z.array(securityAuditEntry).meta({ id: "SecurityAudit" });
