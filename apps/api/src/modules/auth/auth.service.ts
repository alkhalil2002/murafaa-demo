import { Inject, Injectable } from "@nestjs/common";
import {
  canResendOtp,
  canSeeScreen,
  checkOtpChallenge,
  effectiveRole,
  otpExpiry,
  PermLevel,
  PermModule,
  type Role,
  SCREEN_ACCESS,
  type Screen,
} from "@murafaa/auth";
import { ErrorCode, type Me } from "@murafaa/contracts";
import {
  type Db,
  loginCandidates,
  offices,
  otpChallenges,
  type Tx,
  users,
  withTenant,
} from "@murafaa/database";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import { PolicyService } from "../../common/permissions/policy.service.js";
import { isIpAllowed } from "../../common/security/ip-allowlist.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { ENV, type Env } from "../../config/env.js";
import { DB } from "../../database/database.tokens.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { decryptSecret, hashOtpCode, randomOtpCode, sameDigest } from "./auth-crypto.js";
import { OTP_PROVIDER, type OtpChannel, type OtpProvider } from "./otp-provider.js";
import { SessionService } from "./session.service.js";
import { verifyTotpCode } from "./totp.js";

type RequestMeta = { ip: string; userAgent: string | null; requestId: string };

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(OTP_PROVIDER) private readonly provider: OtpProvider,
    private readonly sessions: SessionService,
    private readonly tenantDb: TenantDb,
    private readonly policies: PolicyService,
  ) {}

  /**
   * Send a login code. Unknown, inactive or ambiguous (multi-office) numbers
   * get the same response and nothing is sent, so the endpoint can't be used
   * to discover who is registered.
   */
  async requestOtp(
    phone: string,
    channel: OtpChannel,
    meta: RequestMeta,
  ): Promise<{ sent: true; devCode?: string }> {
    const candidates = await loginCandidates(this.db, phone);
    const user = candidates.length === 1 ? candidates[0] : undefined;
    if (!user) return { sent: true };

    const code = randomOtpCode();
    await withTenant(this.db, user.officeId, async (tx) => {
      const [last] = await tx
        .select({ createdAt: otpChallenges.createdAt })
        .from(otpChallenges)
        .where(and(eq(otpChallenges.userId, user.userId), eq(otpChallenges.phone, phone)))
        .orderBy(desc(otpChallenges.createdAt))
        .limit(1);
      if (!canResendOtp(last?.createdAt ?? null, new Date()))
        throw new ApiException(ErrorCode.RATE_LIMITED);

      await tx.insert(otpChallenges).values({
        officeId: user.officeId,
        userId: user.userId,
        phone,
        codeHash: hashOtpCode(this.env.AUTH_SECRET, phone, code),
        expiresAt: otpExpiry(new Date()),
        createdBy: user.userId,
      });
      await writeAudit(tx, {
        officeId: user.officeId,
        actorId: user.userId,
        action: "auth.otp.sent",
        entity: "users",
        entityId: user.userId,
        after: { channel },
        ip: meta.ip,
        requestId: meta.requestId,
      });
    });
    await this.provider.send(phone, code, channel);
    return this.provider.name === "console" ? { sent: true, devCode: code } : { sent: true };
  }

  /**
   * Verify a login code (and the TOTP code when the user enabled 2FA), then
   * start a session. The OTP is consumed only when every check passes, so a
   * client that learns 2FA is required can retry with the same code.
   */
  async verify(
    input: { phone: string; code: string; totp?: string | undefined },
    meta: RequestMeta,
  ): Promise<{ token: string; user: { id: string; officeId: string; name: string; role: Role } }> {
    const candidates = await loginCandidates(this.db, input.phone);
    const candidate = candidates.length === 1 ? candidates[0] : undefined;
    if (!candidate) throw new ApiException(ErrorCode.OTP_EXPIRED);

    type VerifyOutcome =
      | { error: ErrorCode }
      | { token: string; user: { id: string; officeId: string; name: string; role: Role } };

    // Failures must persist their attempt counter, so they are thrown after the transaction commits.
    const outcome = await withTenant(
      this.db,
      candidate.officeId,
      async (tx): Promise<VerifyOutcome> => {
        const [challenge] = await tx
          .select()
          .from(otpChallenges)
          .where(
            and(
              eq(otpChallenges.userId, candidate.userId),
              eq(otpChallenges.phone, input.phone),
              isNull(otpChallenges.consumedAt),
            ),
          )
          .orderBy(desc(otpChallenges.createdAt))
          .limit(1);

        const check = checkOtpChallenge(challenge ?? null, new Date());
        if (check === "EXPIRED" || !challenge) return { error: ErrorCode.OTP_EXPIRED };
        if (check === "TOO_MANY_ATTEMPTS") return { error: ErrorCode.OTP_TOO_MANY_ATTEMPTS };

        const countAttempt = () =>
          tx
            .update(otpChallenges)
            .set({ attempts: sql`${otpChallenges.attempts} + 1` })
            .where(eq(otpChallenges.id, challenge.id));

        if (
          !sameDigest(
            challenge.codeHash,
            hashOtpCode(this.env.AUTH_SECRET, input.phone, input.code),
          )
        ) {
          await countAttempt();
          return { error: ErrorCode.OTP_INVALID };
        }

        const [user] = await tx
          .select({
            id: users.id,
            name: users.name,
            role: users.role,
            totpEnabled: users.totpEnabled,
            totpSecretEnc: users.totpSecretEnc,
            ipAllowlist: offices.ipAllowlist,
          })
          .from(users)
          .innerJoin(offices, eq(offices.id, users.officeId))
          .where(eq(users.id, candidate.userId))
          .limit(1);
        if (!user) return { error: ErrorCode.OTP_EXPIRED };

        if (user.totpEnabled && user.totpSecretEnc) {
          if (!input.totp) return { error: ErrorCode.TOTP_REQUIRED };
          if (
            !verifyTotpCode(decryptSecret(this.env.ENCRYPTION_KEY, user.totpSecretEnc), input.totp)
          ) {
            await countAttempt();
            return { error: ErrorCode.TOTP_INVALID };
          }
        }

        if (!isIpAllowed(meta.ip, user.ipAllowlist)) {
          await writeAudit(tx, {
            officeId: candidate.officeId,
            actorId: user.id,
            action: "auth.login.ipDenied",
            entity: "users",
            entityId: user.id,
            ip: meta.ip,
            requestId: meta.requestId,
          });
          return { error: ErrorCode.IP_NOT_ALLOWED };
        }

        await tx
          .update(otpChallenges)
          .set({ consumedAt: new Date() })
          .where(eq(otpChallenges.id, challenge.id));
        await tx.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
        const token = await this.sessions.create(tx, {
          officeId: candidate.officeId,
          userId: user.id,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
        await writeAudit(tx, {
          officeId: candidate.officeId,
          actorId: user.id,
          action: "auth.login",
          entity: "users",
          entityId: user.id,
          ip: meta.ip,
          requestId: meta.requestId,
        });
        return {
          token,
          user: {
            id: user.id,
            officeId: candidate.officeId,
            name: user.name,
            role: user.role as Role,
          },
        };
      },
    );

    if ("error" in outcome) throw new ApiException(outcome.error);
    return outcome;
  }

  /** The signed-in user, office, visible screens and effective module levels. */
  async me(principal: Principal): Promise<Me> {
    const [row] = await this.tenantDb.run((tx) =>
      tx
        .select({ name: users.name, phone: users.phone, officeName: offices.name })
        .from(users)
        .innerJoin(offices, eq(offices.id, users.officeId))
        .where(eq(users.id, principal.userId))
        .limit(1),
    );
    if (!row) throw new ApiException(ErrorCode.UNAUTHENTICATED);

    const policy = await this.policies.forOffice(principal.officeId);
    const role = effectiveRole(principal);
    const modules = Object.fromEntries(
      Object.values(PermModule).map((m) => {
        const level = policy.modules[role]?.[m] ?? PermLevel.NONE;
        // Preview is view-only, so never advertise more than VIEW while previewing.
        return [m, principal.previewRole && level !== PermLevel.NONE ? PermLevel.VIEW : level];
      }),
    ) as Me["modules"];

    return {
      user: {
        id: principal.userId,
        officeId: principal.officeId,
        name: row.name,
        role: principal.role,
        previewRole: principal.previewRole ?? null,
      },
      office: {
        id: principal.officeId,
        name: row.officeName,
        readOnly: principal.officeReadOnly ?? false,
      },
      screens: (Object.keys(SCREEN_ACCESS) as Screen[]).filter((s) =>
        canSeeScreen(policy, principal, s),
      ),
      modules,
      isPartner: principal.role === "PARTNER",
      phone: row.phone,
    };
  }

  async logout(principal: Principal, sessionId: string, meta: RequestMeta): Promise<void> {
    await this.sessions.revoke(principal.officeId, sessionId, principal.userId);
    await this.tenantDb.run((tx: Tx) =>
      writeAudit(tx, {
        officeId: principal.officeId,
        actorId: principal.userId,
        action: "auth.logout",
        entity: "users",
        entityId: principal.userId,
        ip: meta.ip,
        requestId: meta.requestId,
      }),
    );
  }
}
