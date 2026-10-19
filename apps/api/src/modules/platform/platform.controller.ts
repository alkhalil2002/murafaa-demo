import { Controller, Get, HttpCode, Inject, Patch, Post, Req, Res } from "@nestjs/common";
import { PLATFORM_SESSION_POLICY } from "@murafaa/auth";
import {
  createdCase,
  ErrorCode,
  idParams,
  platformActivateBody,
  platformActivateConfirmBody,
  platformActivateEnrolment,
  platformActivateOtpResponse,
  platformActivateVerifyBody,
  platformAuditList,
  platformInviteBody,
  platformInviteLink,
  platformTeam,
  platformUpdateMemberBody,
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
import { PlatformActivationService } from "./platform-activation.service.js";
import { PlatformAuthService } from "./platform-auth.service.js";
import { PlatformOfficesService } from "./platform-offices.service.js";
import { PLATFORM_COOKIE } from "./platform-session.service.js";
import { PlatformTeamService } from "./platform-team.service.js";

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
    private readonly team: PlatformTeamService,
    private readonly activation: PlatformActivationService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private signIn(reply: FastifyReply, token: string) {
    void reply.header(
      "set-cookie",
      sessionCookie(
        token,
        PLATFORM_SESSION_POLICY.absoluteTtlMs / 1000,
        this.env.NODE_ENV === "production",
        PLATFORM_COOKIE,
      ),
    );
  }

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

  @PlatformRoute("office.create")
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
    // The denial is audited inside the transaction, which must commit first.
    if ((await this.offices.update(who(req), params.id, body, meta(req))) === "DENIED")
      throw new ApiException(ErrorCode.FORBIDDEN);
    return null;
  }

  @PlatformRoute()
  @Get("audit")
  @ZodResponse(platformAuditList)
  audit() {
    return this.offices.audit();
  }

  // ── فريق المنصة (owner) ──

  @PlatformRoute("team.manage")
  @Get("team")
  @ZodResponse(platformTeam)
  listTeam(@Req() req: FastifyRequest) {
    return this.team.list(who(req));
  }

  @PlatformRoute("team.manage")
  @Post("team")
  @ZodResponse(platformInviteLink)
  invite(
    @ZodBody(platformInviteBody) body: z.infer<typeof platformInviteBody>,
    @Req() req: FastifyRequest,
  ) {
    return this.team.invite(who(req), body, meta(req));
  }

  @PlatformRoute("team.manage")
  @Patch("team/:id")
  @HttpCode(200)
  async updateMember(
    @ZodParams(idParams) params: Id,
    @ZodBody(platformUpdateMemberBody) body: z.infer<typeof platformUpdateMemberBody>,
    @Req() req: FastifyRequest,
  ) {
    await this.team.update(who(req), params.id, body, meta(req));
    return null;
  }

  @PlatformRoute("team.manage")
  @Post("team/:id/reset")
  @HttpCode(200)
  @ZodResponse(platformInviteLink)
  resetMember(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    return this.team.reset(who(req), params.id, meta(req));
  }

  // ── Activation from a one-time link (no session yet) ──

  @Public()
  @Post("activate/otp")
  @HttpCode(200)
  @ZodResponse(platformActivateOtpResponse)
  activateOtp(
    @ZodBody(platformActivateBody) body: z.infer<typeof platformActivateBody>,
    @Req() req: FastifyRequest,
  ) {
    return this.activation.sendOtp(body.token, meta(req));
  }

  @Public()
  @Post("activate/verify")
  @HttpCode(200)
  @ZodResponse(platformActivateEnrolment)
  activateVerify(
    @ZodBody(platformActivateVerifyBody) body: z.infer<typeof platformActivateVerifyBody>,
    @Req() req: FastifyRequest,
  ) {
    return this.activation.verifyOtp(body.token, body.code, meta(req));
  }

  @Public()
  @Post("activate/confirm")
  @HttpCode(200)
  @ZodResponse(platformMe)
  async activateConfirm(
    @ZodBody(platformActivateConfirmBody) body: z.infer<typeof platformActivateConfirmBody>,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { token, principal } = await this.activation.confirm(body.token, body.totp, meta(req));
    this.signIn(reply, token);
    return this.auth.me(principal);
  }
}
