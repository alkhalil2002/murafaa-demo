import { Inject, Injectable } from "@nestjs/common";
import {
  canResendOtp,
  checkOtpChallenge,
  otpExpiry,
  PLATFORM_INVITE_MAX_ATTEMPTS,
} from "@murafaa/auth";
import { ErrorCode } from "@murafaa/contracts";
import {
  type Db,
  platformAdmins,
  platformInvites,
  platformOtpChallenges,
  type Tx,
  withPlatform,
} from "@murafaa/database";
import { qrSvg } from "@murafaa/documents";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { ApiException } from "../../common/http/api.exception.js";
import type { PlatformPrincipal } from "../../common/tenancy/principal.js";
import { ENV, type Env } from "../../config/env.js";
import { DB } from "../../database/database.tokens.js";
import {
  decryptSecret,
  encryptSecret,
  randomOtpCode,
  sameDigest,
  sha256,
} from "../auth/auth-crypto.js";
import { OTP_PROVIDER, type OtpProvider } from "../auth/otp-provider.js";
import { generateTotpSecret, totpUri, verifyTotpCode } from "../auth/totp.js";
import {
  maskPhone,
  platformAudit,
  type PlatformMeta,
  platformOtpHash,
  PlatformSessionService,
} from "./platform-session.service.js";

const invalidLink = () =>
  new ApiException(ErrorCode.NOT_FOUND, undefined, "platform.err.LINK_INVALID");

type Outcome<T> = { error: ApiException } | { ok: T };

/**
 * Activation of a platform member from their one-time link: an OTP to the
 * invited phone, then a new authenticator secret shown only in their own
 * browser, then its first code. Wrong codes count against the link, which is
 * burned at the limit. Nobody else ever sees the secret.
 */
@Injectable()
export class PlatformActivationService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(OTP_PROVIDER) private readonly provider: OtpProvider,
    private readonly sessions: PlatformSessionService,
  ) {}

  /** The usable invite behind a token, with its member; anything else is "invalid link". */
  private async invite(tx: Tx, token: string) {
    const [row] = await tx
      .select({ inv: platformInvites, admin: platformAdmins })
      .from(platformInvites)
      .innerJoin(platformAdmins, eq(platformAdmins.id, platformInvites.adminId))
      .where(eq(platformInvites.tokenHash, sha256(token)))
      .for("update");
    if (
      !row ||
      row.inv.consumedAt ||
      row.inv.expiresAt.getTime() <= Date.now() ||
      row.inv.attempts >= PLATFORM_INVITE_MAX_ATTEMPTS ||
      !row.admin.isActive ||
      row.admin.deletedAt
    )
      throw invalidLink();
    return row;
  }

  /** One wrong code: counts against the link and burns it at the limit. */
  private async miss(tx: Tx, inviteId: string, attempts: number) {
    const burned = attempts + 1 >= PLATFORM_INVITE_MAX_ATTEMPTS;
    await tx
      .update(platformInvites)
      .set({
        attempts: sql`${platformInvites.attempts} + 1`,
        ...(burned ? { consumedAt: new Date() } : {}),
      })
      .where(eq(platformInvites.id, inviteId));
  }

  async sendOtp(token: string, meta: PlatformMeta) {
    const code = randomOtpCode();
    const { phone, name } = await withPlatform(this.db, async (tx) => {
      const { admin } = await this.invite(tx, token);
      const [last] = await tx
        .select({ createdAt: platformOtpChallenges.createdAt })
        .from(platformOtpChallenges)
        .where(eq(platformOtpChallenges.adminId, admin.id))
        .orderBy(desc(platformOtpChallenges.createdAt))
        .limit(1);
      if (!canResendOtp(last?.createdAt ?? null, new Date()))
        throw new ApiException(ErrorCode.RATE_LIMITED);
      await tx.insert(platformOtpChallenges).values({
        adminId: admin.id,
        phone: admin.phone,
        codeHash: platformOtpHash(this.env, admin.phone, code),
        expiresAt: otpExpiry(new Date()),
      });
      await platformAudit(tx, {
        actorId: admin.id,
        action: "platform.invite.otp",
        ip: meta.ip,
        requestId: meta.requestId,
      });
      return admin;
    });
    await this.provider.send(phone, code, "whatsapp");
    return {
      name,
      phone: maskPhone(phone),
      ...(this.provider.name === "console" ? { devCode: code } : {}),
    };
  }

  async verifyOtp(token: string, code: string, meta: PlatformMeta) {
    const outcome = await withPlatform(
      this.db,
      async (tx): Promise<Outcome<{ qrSvg: string; setupKey: string }>> => {
        const { inv, admin } = await this.invite(tx, token);
        const [challenge] = await tx
          .select()
          .from(platformOtpChallenges)
          .where(
            and(
              eq(platformOtpChallenges.adminId, admin.id),
              isNull(platformOtpChallenges.consumedAt),
            ),
          )
          .orderBy(desc(platformOtpChallenges.createdAt))
          .limit(1);
        const check = checkOtpChallenge(challenge ?? null, new Date());
        if (check === "EXPIRED" || !challenge)
          return { error: new ApiException(ErrorCode.OTP_EXPIRED) };
        if (check === "TOO_MANY_ATTEMPTS")
          return { error: new ApiException(ErrorCode.OTP_TOO_MANY_ATTEMPTS) };
        if (!sameDigest(challenge.codeHash, platformOtpHash(this.env, admin.phone, code))) {
          await tx
            .update(platformOtpChallenges)
            .set({ attempts: sql`${platformOtpChallenges.attempts} + 1` })
            .where(eq(platformOtpChallenges.id, challenge.id));
          await this.miss(tx, inv.id, inv.attempts);
          return { error: new ApiException(ErrorCode.OTP_INVALID) };
        }
        await tx
          .update(platformOtpChallenges)
          .set({ consumedAt: new Date() })
          .where(eq(platformOtpChallenges.id, challenge.id));
        const secret = generateTotpSecret();
        await tx
          .update(platformInvites)
          .set({ totpPendingEnc: encryptSecret(this.env.ENCRYPTION_KEY, secret) })
          .where(eq(platformInvites.id, inv.id));
        await platformAudit(tx, {
          actorId: admin.id,
          action: "platform.invite.verified",
          ip: meta.ip,
          requestId: meta.requestId,
        });
        return {
          ok: {
            qrSvg: qrSvg(totpUri(secret, admin.phone, "Murafaa Platform"), 220),
            setupKey: secret,
          },
        };
      },
    );
    // Thrown after commit, so a wrong code still counts.
    if ("error" in outcome) throw outcome.error;
    return outcome.ok;
  }

  async confirm(token: string, totp: string, meta: PlatformMeta) {
    if (!this.sessions.ipAllowed(meta.ip)) throw new ApiException(ErrorCode.IP_NOT_ALLOWED);
    const outcome = await withPlatform(
      this.db,
      async (tx): Promise<Outcome<{ token: string; principal: PlatformPrincipal }>> => {
        const { inv, admin } = await this.invite(tx, token);
        // The OTP step comes first: without it there is no secret to confirm.
        if (!inv.totpPendingEnc)
          return {
            error: new ApiException(ErrorCode.CONFLICT, undefined, "platform.err.OTP_FIRST"),
          };
        const pending = inv.totpPendingEnc;
        if (!verifyTotpCode(decryptSecret(this.env.ENCRYPTION_KEY, pending), totp)) {
          await this.miss(tx, inv.id, inv.attempts);
          return { error: new ApiException(ErrorCode.TOTP_INVALID) };
        }
        const now = new Date();
        await tx
          .update(platformAdmins)
          .set({ totpSecretEnc: pending, activatedAt: now, lastLoginAt: now })
          .where(eq(platformAdmins.id, admin.id));
        await tx
          .update(platformInvites)
          .set({ consumedAt: now })
          .where(eq(platformInvites.id, inv.id));
        const session = await this.sessions.create(tx, admin.id, meta);
        await platformAudit(tx, {
          actorId: admin.id,
          action: "platform.admin.activated",
          details: { role: admin.role },
          ip: meta.ip,
          requestId: meta.requestId,
        });
        return { ok: { token: session, principal: { adminId: admin.id, role: admin.role } } };
      },
    );
    if ("error" in outcome) throw outcome.error;
    return outcome.ok;
  }
}
