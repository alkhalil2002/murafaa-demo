import { Inject, Injectable } from "@nestjs/common";
import { canResendOtp, checkOtpChallenge, otpExpiry } from "@murafaa/auth";
import { ErrorCode } from "@murafaa/contracts";
import {
  clients,
  type Db,
  employees,
  offices,
  portalCandidates,
  portalOtpChallenges,
  withTenant,
} from "@murafaa/database";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { PortalPrincipal } from "../../common/tenancy/principal.js";
import { ENV, type Env } from "../../config/env.js";
import { DB } from "../../database/database.tokens.js";
import { hashOtpCode, randomOtpCode, sameDigest } from "../auth/auth-crypto.js";
import { OTP_PROVIDER, type OtpChannel, type OtpProvider } from "../auth/otp-provider.js";
import { type PortalKind, PortalSessionService } from "./portal-session.service.js";

type Meta = { ip: string; userAgent: string | null; requestId: string };

/**
 * Client- and employee-portal sign-in by OTP (legacy portal-otp.ts,
 * emp-portal-otp.ts). Same rules as staff sign-in: unknown or ambiguous
 * numbers get the same answer and nothing is sent; codes expire, are
 * rate-limited and attempt-limited. Codes are bound to the portal kind, so a
 * staff or other-portal code never opens this one.
 */
@Injectable()
export class PortalAuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    @Inject(OTP_PROVIDER) private readonly provider: OtpProvider,
    private readonly sessions: PortalSessionService,
  ) {}

  private hash(kind: PortalKind, phone: string, code: string) {
    return hashOtpCode(this.env.AUTH_SECRET, `portal:${kind}:${phone}`, code);
  }

  private async subject(phone: string, kind: PortalKind) {
    const found = await portalCandidates(this.db, phone, kind);
    return found.length === 1 ? found[0] : undefined;
  }

  async requestOtp(kind: PortalKind, phone: string, channel: OtpChannel, meta: Meta) {
    const s = await this.subject(phone, kind);
    if (!s) return { sent: true as const };
    const code = randomOtpCode();
    await withTenant(this.db, s.officeId, async (tx) => {
      const [last] = await tx
        .select({ createdAt: portalOtpChallenges.createdAt })
        .from(portalOtpChallenges)
        .where(
          and(eq(portalOtpChallenges.kind, kind), eq(portalOtpChallenges.subjectId, s.subjectId)),
        )
        .orderBy(desc(portalOtpChallenges.createdAt))
        .limit(1);
      if (!canResendOtp(last?.createdAt ?? null, new Date()))
        throw new ApiException(ErrorCode.RATE_LIMITED);
      await tx.insert(portalOtpChallenges).values({
        officeId: s.officeId,
        kind,
        subjectId: s.subjectId,
        phone,
        codeHash: this.hash(kind, phone, code),
        expiresAt: otpExpiry(new Date()),
      });
      await writeAudit(tx, {
        officeId: s.officeId,
        actorId: null,
        action: "portal.otp.sent",
        entity: kind === "CLIENT" ? "clients" : "employees",
        entityId: s.subjectId,
        after: { portal: kind, channel },
        ip: meta.ip,
        requestId: meta.requestId,
      });
    });
    await this.provider.send(phone, code, channel);
    return this.provider.name === "console"
      ? { sent: true as const, devCode: code }
      : { sent: true as const };
  }

  async verify(kind: PortalKind, phone: string, code: string, meta: Meta) {
    const s = await this.subject(phone, kind);
    if (!s) throw new ApiException(ErrorCode.OTP_EXPIRED);
    const outcome = await withTenant(
      this.db,
      s.officeId,
      async (tx): Promise<{ error: ErrorCode } | { token: string }> => {
        const [challenge] = await tx
          .select()
          .from(portalOtpChallenges)
          .where(
            and(
              eq(portalOtpChallenges.kind, kind),
              eq(portalOtpChallenges.subjectId, s.subjectId),
              eq(portalOtpChallenges.phone, phone),
              isNull(portalOtpChallenges.consumedAt),
            ),
          )
          .orderBy(desc(portalOtpChallenges.createdAt))
          .limit(1);
        const check = checkOtpChallenge(challenge ?? null, new Date());
        if (check === "EXPIRED" || !challenge) return { error: ErrorCode.OTP_EXPIRED };
        if (check === "TOO_MANY_ATTEMPTS") return { error: ErrorCode.OTP_TOO_MANY_ATTEMPTS };
        if (!sameDigest(challenge.codeHash, this.hash(kind, phone, code))) {
          await tx
            .update(portalOtpChallenges)
            .set({ attempts: sql`${portalOtpChallenges.attempts} + 1` })
            .where(eq(portalOtpChallenges.id, challenge.id));
          return { error: ErrorCode.OTP_INVALID };
        }
        await tx
          .update(portalOtpChallenges)
          .set({ consumedAt: new Date() })
          .where(eq(portalOtpChallenges.id, challenge.id));
        const token = await this.sessions.create(tx, {
          officeId: s.officeId,
          kind,
          subjectId: s.subjectId,
          ip: meta.ip,
          userAgent: meta.userAgent,
        });
        await writeAudit(tx, {
          officeId: s.officeId,
          actorId: null,
          action: "portal.login",
          entity: kind === "CLIENT" ? "clients" : "employees",
          entityId: s.subjectId,
          after: { portal: kind },
          ip: meta.ip,
          requestId: meta.requestId,
        });
        return { token };
      },
    );
    if ("error" in outcome) throw new ApiException(outcome.error);
    const principal: PortalPrincipal = { kind, subjectId: s.subjectId, officeId: s.officeId };
    return { token: outcome.token, principal };
  }

  /** Name and office for the portal header. */
  me(who: PortalPrincipal) {
    return withTenant(this.db, who.officeId, async (tx) => {
      const [office] = await tx.select({ name: offices.name }).from(offices).limit(1);
      const [subject] =
        who.kind === "CLIENT"
          ? await tx
              .select({ name: clients.name })
              .from(clients)
              .where(eq(clients.id, who.subjectId))
          : await tx
              .select({ name: employees.name })
              .from(employees)
              .where(eq(employees.id, who.subjectId));
      if (!subject || !office) throw new ApiException(ErrorCode.UNAUTHENTICATED);
      return { kind: who.kind, name: subject.name, officeName: office.name };
    });
  }

  async logout(who: PortalPrincipal, sessionId: string, meta: Meta) {
    await this.sessions.revoke(who.officeId, sessionId);
    await withTenant(this.db, who.officeId, (tx) =>
      writeAudit(tx, {
        officeId: who.officeId,
        actorId: null,
        action: "portal.logout",
        entity: who.kind === "CLIENT" ? "clients" : "employees",
        entityId: who.subjectId,
        after: { portal: who.kind },
        ip: meta.ip,
        requestId: meta.requestId,
      }),
    );
  }
}
