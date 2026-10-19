import { Controller, Get, HttpCode, Inject, Patch, Post, Req, Res } from "@nestjs/common";
import { PLATFORM_SESSION_POLICY } from "@murafaa/auth";
import {
  createdCase,
  ErrorCode,
  idParams,
  platformAuditList,
  platformCreateOfficeBody,
  platformMe,
  platformOfficeDetail,
  platformOfficeList,
  platformUpdateOfficeBody,
  platformVerifyBody,
  requestOtpBody,
  requestOtpResponse,
} from "@murafaa/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { PlatformRoute, Public } from "../../common/permissions/permission.decorators.js";
import type { PlatformPrincipal } from "../../common/tenancy/principal.js";
import { ZodBody, ZodParams, ZodResponse } from "../../common/zod/zod.decorators.js";
import { ENV, type Env } from "../../config/env.js";
import { clearedSessionCookie, sessionCookie } from "../auth/cookies.js";
import { PlatformAuthService } from "./platform-auth.service.js";
import { PlatformOfficesService } from "./platform-offices.service.js";
import { PLATFORM_COOKIE } from "./platform-session.service.js";

type Id = z.infer<typeof idParams>;
const meta = (req: FastifyRequest) => ({
  ip: req.ip,
  userAgent: req.headers["user-agent"] ?? null,
  requestId: String(req.id),
});
const who = (req: FastifyRequest): PlatformPrincipal => {
  if (!req.platform) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return req.platform;
};

/**
 * إدارة المنصة: the Murafaa team's layer above the offices. Its own cookie
 * and session; it sees office metadata and counts, never office content.
 */
@Controller("platform")
export class PlatformController {
  constructor(
    private readonly auth: PlatformAuthService,
    private readonly offices: PlatformOfficesService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Post("auth/otp")
  @HttpCode(200)
  @ZodResponse(requestOtpResponse)
  requestOtp(
    @ZodBody(requestOtpBody) body: z.infer<typeof requestOtpBody>,
    @Req() req: FastifyRequest,
  ) {
    return this.auth.requestOtp(body.phone, body.channel, meta(req));
  }

  @Public()
  @Post("auth/verify")
  @HttpCode(200)
  @ZodResponse(platformMe)
  async verify(
    @ZodBody(platformVerifyBody) body: z.infer<typeof platformVerifyBody>,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { token, principal } = await this.auth.verify(
      body.phone,
      body.code,
      body.totp,
      meta(req),
    );
    void reply.header(
      "set-cookie",
      sessionCookie(
        token,
        PLATFORM_SESSION_POLICY.absoluteTtlMs / 1000,
        this.env.NODE_ENV === "production",
        PLATFORM_COOKIE,
      ),
    );
    return this.auth.me(principal);
  }

  @PlatformRoute()
  @Post("auth/logout")
  @HttpCode(200)
  async logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    if (!req.platformSessionId) throw new ApiException(ErrorCode.UNAUTHENTICATED);
    await this.auth.logout(who(req), req.platformSessionId, meta(req));
    void reply.header(
      "set-cookie",
      clearedSessionCookie(this.env.NODE_ENV === "production", PLATFORM_COOKIE),
    );
    return null;
  }

  @PlatformRoute()
  @Get("me")
  @ZodResponse(platformMe)
  me(@Req() req: FastifyRequest) {
    return this.auth.me(who(req));
  }

  @PlatformRoute()
  @Get("offices")
  @ZodResponse(platformOfficeList)
  list() {
    return this.offices.list();
  }

  @PlatformRoute()
  @Post("offices")
  @ZodResponse(createdCase)
  create(
    @ZodBody(platformCreateOfficeBody) body: z.infer<typeof platformCreateOfficeBody>,
    @Req() req: FastifyRequest,
  ) {
    return this.offices.create(who(req), body, meta(req));
  }

  @PlatformRoute()
  @Get("offices/:id")
  @ZodResponse(platformOfficeDetail)
  detail(@ZodParams(idParams) params: Id) {
    return this.offices.detail(params.id);
  }

  @PlatformRoute()
  @Patch("offices/:id")
  @HttpCode(200)
  async update(
    @ZodParams(idParams) params: Id,
    @ZodBody(platformUpdateOfficeBody) body: z.infer<typeof platformUpdateOfficeBody>,
    @Req() req: FastifyRequest,
  ) {
    await this.offices.update(who(req), params.id, body, meta(req));
    return null;
  }

  @PlatformRoute()
  @Get("audit")
  @ZodResponse(platformAuditList)
  audit() {
    return this.offices.audit();
  }
}
