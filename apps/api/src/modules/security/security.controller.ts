import { Controller, Get, HttpCode, Post, Put, Req } from "@nestjs/common";
import {
  ErrorCode,
  ipAllowlist,
  securityStatus,
  totpCodeBody,
  totpEnrollment,
} from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { Authenticated, RequirePartner } from "../../common/permissions/permission.decorators.js";
import { ZodBody, ZodResponse } from "../../common/zod/zod.decorators.js";
import { SecurityService } from "./security.service.js";

function caller(req: FastifyRequest) {
  if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return { principal: req.principal, meta: { ip: req.ip, requestId: String(req.id) } };
}

/** Account security (legacy /account/security): own 2FA, and the office IP allowlist for partners. */
@Controller("security")
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @Authenticated()
  @Get("status")
  @ZodResponse(securityStatus)
  status(@Req() req: FastifyRequest) {
    return this.security.status(caller(req).principal);
  }

  @Authenticated()
  @Post("totp/begin")
  @HttpCode(200)
  @ZodResponse(totpEnrollment)
  begin(@Req() req: FastifyRequest) {
    return this.security.beginTotp(caller(req).principal);
  }

  @Authenticated()
  @Post("totp/confirm")
  @HttpCode(200)
  async confirm(
    @ZodBody(totpCodeBody) body: z.infer<typeof totpCodeBody>,
    @Req() req: FastifyRequest,
  ) {
    const { principal, meta } = caller(req);
    await this.security.confirmTotp(principal, body.code, meta);
    return null;
  }

  @Authenticated()
  @Post("totp/disable")
  @HttpCode(200)
  async disable(
    @ZodBody(totpCodeBody) body: z.infer<typeof totpCodeBody>,
    @Req() req: FastifyRequest,
  ) {
    const { principal, meta } = caller(req);
    await this.security.disableTotp(principal, body.code, meta);
    return null;
  }

  @RequirePartner("security.ipAllowlist.set")
  @Get("ip-allowlist")
  @ZodResponse(ipAllowlist)
  async getIpAllowlist(@Req() req: FastifyRequest) {
    return { entries: await this.security.ipAllowlist(caller(req).principal) };
  }

  @RequirePartner("security.ipAllowlist.set")
  @Put("ip-allowlist")
  @ZodResponse(ipAllowlist)
  async setIpAllowlist(
    @ZodBody(ipAllowlist) body: z.infer<typeof ipAllowlist>,
    @Req() req: FastifyRequest,
  ) {
    const { principal, meta } = caller(req);
    return { entries: await this.security.setIpAllowlist(principal, body.entries, meta) };
  }
}
