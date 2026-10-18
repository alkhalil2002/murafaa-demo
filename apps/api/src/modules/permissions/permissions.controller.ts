import { Controller, Delete, Get, HttpCode, Post, Put, Req } from "@nestjs/common";
import {
  ErrorCode,
  officeUsers,
  roleMatrix,
  securityAudit,
  setCaseScopeBody,
  setModuleLevelBody,
  setUserRoleBody,
  startPreviewBody,
  userIdParams,
} from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { AllowInPreview, RequirePartner } from "../../common/permissions/permission.decorators.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { ZodBody, ZodParams, ZodResponse } from "../../common/zod/zod.decorators.js";
import { PermissionsService } from "./permissions.service.js";

function caller(req: FastifyRequest): {
  principal: Principal;
  meta: { ip: string; requestId: string };
} {
  if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return { principal: req.principal, meta: { ip: req.ip, requestId: String(req.id) } };
}

/** Partner-only permissions administration (docs/04, legacy /perms). */
@Controller("permissions")
export class PermissionsController {
  constructor(private readonly perms: PermissionsService) {}

  @RequirePartner("permissions.manage")
  @Get("matrix")
  @ZodResponse(roleMatrix)
  matrix(@Req() req: FastifyRequest) {
    return this.perms.matrix(caller(req).principal.officeId);
  }

  @RequirePartner("permissions.manage")
  @Put("matrix/level")
  @ZodResponse(roleMatrix)
  async setLevel(
    @ZodBody(setModuleLevelBody) body: z.infer<typeof setModuleLevelBody>,
    @Req() req: FastifyRequest,
  ) {
    const { principal, meta } = caller(req);
    await this.perms.setModuleLevel(principal, body, meta);
    return this.perms.matrix(principal.officeId);
  }

  @RequirePartner("permissions.manage")
  @Put("matrix/scope")
  @ZodResponse(roleMatrix)
  async setScope(
    @ZodBody(setCaseScopeBody) body: z.infer<typeof setCaseScopeBody>,
    @Req() req: FastifyRequest,
  ) {
    const { principal, meta } = caller(req);
    await this.perms.setCaseScope(principal, body, meta);
    return this.perms.matrix(principal.officeId);
  }

  @RequirePartner("permissions.manage")
  @Get("users")
  @ZodResponse(officeUsers)
  users() {
    return this.perms.users();
  }

  @RequirePartner("permissions.manage")
  @Put("users/:id/role")
  @ZodResponse(officeUsers)
  async setUserRole(
    @ZodParams(userIdParams) params: z.infer<typeof userIdParams>,
    @ZodBody(setUserRoleBody) body: z.infer<typeof setUserRoleBody>,
    @Req() req: FastifyRequest,
  ) {
    const { principal, meta } = caller(req);
    await this.perms.setUserRole(principal, params.id, body.role, meta);
    return this.perms.users();
  }

  @RequirePartner("security.audit.view")
  @Get("audit")
  @ZodResponse(securityAudit)
  audit() {
    return this.perms.securityAudit();
  }

  /** "معاينة حسب الدور": view the app as another role. Checks the REAL role, so it works mid-preview. */
  @RequirePartner("rolePreview.start")
  @AllowInPreview()
  @Post("preview")
  @HttpCode(200)
  async startPreview(
    @ZodBody(startPreviewBody) body: z.infer<typeof startPreviewBody>,
    @Req() req: FastifyRequest,
  ) {
    const { principal, meta } = caller(req);
    await this.perms.setPreview(principal, req.sessionId!, body.role, meta);
    return null;
  }

  @RequirePartner("rolePreview.start")
  @AllowInPreview()
  @Delete("preview")
  @HttpCode(200)
  async endPreview(@Req() req: FastifyRequest) {
    const { principal, meta } = caller(req);
    await this.perms.setPreview(principal, req.sessionId!, null, meta);
    return null;
  }
}
