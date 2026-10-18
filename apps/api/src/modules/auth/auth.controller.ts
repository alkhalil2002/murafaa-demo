import { Controller, Get, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import {
  ErrorCode,
  type Me,
  me,
  requestOtpBody,
  requestOtpResponse,
  verifyOtpBody,
  verifyOtpResponse,
} from "@murafaa/contracts";
import type { z } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import { SESSION_POLICY } from "@murafaa/auth";
import { ApiException } from "../../common/http/api.exception.js";
import {
  AllowInPreview,
  Authenticated,
  Public,
} from "../../common/permissions/permission.decorators.js";
import { ZodBody, ZodResponse } from "../../common/zod/zod.decorators.js";
import { ENV, type Env } from "../../config/env.js";
import { AuthService } from "./auth.service.js";
import { clearedSessionCookie, sessionCookie } from "./cookies.js";

const meta = (req: FastifyRequest) => ({
  ip: req.ip,
  userAgent: req.headers["user-agent"] ?? null,
  requestId: String(req.id),
});

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** Send a 6-digit login code by WhatsApp (default) or SMS. */
  @Public()
  @Post("otp")
  @HttpCode(200)
  @ZodResponse(requestOtpResponse)
  requestOtp(
    @ZodBody(requestOtpBody) body: z.infer<typeof requestOtpBody>,
    @Req() req: FastifyRequest,
  ): Promise<z.infer<typeof requestOtpResponse>> {
    return this.auth.requestOtp(body.phone, body.channel, meta(req));
  }

  /** Verify the code (+ TOTP when enabled) and start a session. */
  @Public()
  @Post("verify")
  @HttpCode(200)
  @ZodResponse(verifyOtpResponse)
  async verify(
    @ZodBody(verifyOtpBody) body: z.infer<typeof verifyOtpBody>,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<z.infer<typeof verifyOtpResponse>> {
    const { token, user } = await this.auth.verify(body, meta(req));
    const secure = this.env.NODE_ENV === "production";
    void reply.header(
      "set-cookie",
      sessionCookie(token, SESSION_POLICY.absoluteTtlMs / 1000, secure),
    );
    const mobile = req.headers["x-client-type"] === "mobile";
    return { user: { ...user, previewRole: null }, ...(mobile ? { token } : {}) };
  }

  @Authenticated()
  @Get("me")
  @ZodResponse(me)
  current(@Req() req: FastifyRequest): Promise<Me> {
    if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
    return this.auth.me(req.principal);
  }

  /** End the session. Allowed during role preview so a previewing partner can still sign out. */
  @Authenticated()
  @AllowInPreview()
  @Post("logout")
  @HttpCode(200)
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<null> {
    if (!req.principal || !req.sessionId) throw new ApiException(ErrorCode.UNAUTHENTICATED);
    await this.auth.logout(req.principal, req.sessionId, meta(req));
    void reply.header("set-cookie", clearedSessionCookie(this.env.NODE_ENV === "production"));
    return null;
  }
}
