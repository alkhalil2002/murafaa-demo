import { Inject, Injectable } from "@nestjs/common";
import { canResendOtp, checkOtpChallenge, otpExpiry } from "@murafaa/auth";
import { ErrorCode } from "@murafaa/contracts";
import {
  type Db,
  platformAdmins,
  platformOtpChallenges,
  type Tx,
  withPlatform,
} from "@murafaa/database";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { ApiException } from "../../common/http/api.exception.js";
import type { PlatformPrincipal } from "../../common/tenancy/principal.js";
import { ENV, type Env } from "../../config/env.js";
import { DB } from "../../database/database.tokens.js";
import { decryptSecret, hashOtpCode, randomOtpCode, sameDigest } from "../auth/auth-crypto.js";
import { OTP_PROVIDER, type OtpChannel, type OtpProvider } from "../auth/otp-provider.js";
import { verifyTotpCode } from "../auth/totp.js";
import {
  platformAudit,
  type PlatformMeta,
  PlatformSessionService,
} from "./platform-session.service.js";

/**
 * إدارة المنصة sign-in: an OTP to the admin's phone plus, always, the code
 * from their authenticator. Unknown numbers get the same answer and nothing
 * is sent; codes expire and are rate- and attempt-limited like staff ones.
 */
@Injectable()
export class PlatformAuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(OTP_PROVIDER) private readonly provider: OtpProvider,
    private readonly sessions: PlatformSessionService,
  ) {}

  private hash(phone: string, code: string) {
    return hashOtpCode(this.env.AUTH_SECRET, `platform:${phone}`, code);
  }

  private admin(tx: Tx, phone: string) {
    return tx
      .select()
      .from(platformAdmins)
      .where(
        and(
          eq(platformAdmins.phone, phone),
          eq(platformAdmins.isActive, true),
          isNull(platformAdmins.deletedAt),
        ),
      )
      .then((r) => r[0]);
  }

  async requestOtp(phone: string, channel: OtpChannel, meta: PlatformMeta) {
    const code = randomOtpCode();
    const sent = await withPlatform(this.db, async (tx) => {
      const a = await this.admin(tx, phone);
      if (!a) return false;
      const [last] = await tx
        .select({ createdAt: platformOtpChallenges.createdAt })
        .from(platformOtpChallenges)
        .where(eq(platformOtpChallenges.adminId, a.id))
        .orderBy(desc(platformOtpChallenges.createdAt))
        .limit(1);
      if (!canResendOtp(last?.createdAt ?? null, new Date()))
        throw new ApiException(ErrorCode.RATE_LIMITED);
      await tx.insert(platformOtpChallenges).values({
        adminId: a.id,
        phone,
        codeHash: this.hash(phone, code),
        expiresAt: otpExpiry(new Date()),
      });
      await platformAudit(tx, {
        actorId: a.id,
        action: "platform.otp.sent",
        details: { channel },
        ip: meta.ip,
        requestId: meta.requestId,
      });
      return true;
    });
    if (!sent) return { sent: true as const };
    await this.provider.send(phone, code, channel);
    return this.provider.name === "console"
      ? { sent: true as const, devCode: code }
      : { sent: true as const };
  }

  async verify(phone: string, code: string, totp: string, meta: PlatformMeta) {
    if (!this.sessions.ipAllowed(meta.ip)) throw new ApiException(ErrorCode.IP_NOT_ALLOWED);
    const outcome = await withPlatform(
      this.db,
      async (
        tx,
      ): Promise<{ error: ErrorCode } | { token: string; principal: PlatformPrincipal }> => {
        const a = await this.admin(tx, phone);
        if (!a) return { error: ErrorCode.OTP_EXPIRED };
        const [challenge] = await tx
          .select()
          .from(platformOtpChallenges)
          .where(
            and(
              eq(platformOtpChallenges.adminId, a.id),
              eq(platformOtpChallenges.phone, phone),
              isNull(platformOtpChallenges.consumedAt),
            ),
          )
          .orderBy(desc(platformOtpChallenges.createdAt))
          .limit(1);
        const check = checkOtpChallenge(challenge ?? null, new Date());
        if (check === "EXPIRED" || !challenge) return { error: ErrorCode.OTP_EXPIRED };
        if (check === "TOO_MANY_ATTEMPTS") return { error: ErrorCode.OTP_TOO_MANY_ATTEMPTS };
        const otpOk = sameDigest(challenge.codeHash, this.hash(phone, code));
        const totpOk =
          otpOk && verifyTotpCode(decryptSecret(this.env.ENCRYPTION_KEY, a.totpSecretEnc), totp);
        if (!totpOk) {
          // A wrong authenticator code spends an attempt too, so neither can be guessed.
          await tx
            .update(platformOtpChallenges)
            .set({ attempts: sql`${platformOtpChallenges.attempts} + 1` })
            .where(eq(platformOtpChallenges.id, challenge.id));
          await platformAudit(tx, {
            actorId: a.id,
            action: "platform.login.failed",
            details: { reason: otpOk ? "totp" : "otp" },
            ip: meta.ip,
            requestId: meta.requestId,
          });
          return { error: otpOk ? ErrorCode.TOTP_INVALID : ErrorCode.OTP_INVALID };
        }
        await tx
          .update(platformOtpChallenges)
          .set({ consumedAt: new Date() })
          .where(eq(platformOtpChallenges.id, challenge.id));
        await tx
          .update(platformAdmins)
          .set({ lastLoginAt: new Date() })
          .where(eq(platformAdmins.id, a.id));
        const token = await this.sessions.create(tx, a.id, meta);
        await platformAudit(tx, {
          actorId: a.id,
          action: "platform.login",
          ip: meta.ip,
          requestId: meta.requestId,
        });
        return { token, principal: { adminId: a.id } };
      },
    );
    // Thrown after commit, so a failed attempt is still counted.
    if ("error" in outcome) throw new ApiException(outcome.error);
    return outcome;
  }

  me(who: PlatformPrincipal) {
    return withPlatform(this.db, async (tx) => {
      const [a] = await tx
        .select({ name: platformAdmins.name })
        .from(platformAdmins)
        .where(eq(platformAdmins.id, who.adminId));
      if (!a) throw new ApiException(ErrorCode.UNAUTHENTICATED);
      return { name: a.name };
    });
  }

  async logout(who: PlatformPrincipal, sessionId: string, meta: PlatformMeta) {
    await this.sessions.revoke(sessionId);
    await withPlatform(this.db, (tx) =>
      platformAudit(tx, {
        actorId: who.adminId,
        action: "platform.logout",
        ip: meta.ip,
        requestId: meta.requestId,
      }),
    );
  }
}
