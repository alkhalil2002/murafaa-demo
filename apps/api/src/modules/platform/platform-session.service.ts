import { Inject, Injectable } from "@nestjs/common";
import { isSessionLive, PLATFORM_SESSION_POLICY } from "@murafaa/auth";
import {
  type Db,
  platformAdmins,
  platformAuditLog,
  platformSessions,
  type Tx,
  withPlatform,
} from "@murafaa/database";
import { and, eq, isNull } from "drizzle-orm";
import { isIpAllowed } from "../../common/security/ip-allowlist.js";
import type { PlatformPrincipal } from "../../common/tenancy/principal.js";
import { ENV, type Env } from "../../config/env.js";
import { DB } from "../../database/database.tokens.js";
import { hashOtpCode, newSessionSecret, sameDigest, sha256 } from "../auth/auth-crypto.js";

export const PLATFORM_COOKIE = "murafaa_platform";

export type PlatformMeta = { ip: string; userAgent: string | null; requestId: string };

/** Platform tokens are `p.<sessionId>.<secret>`: they name no office. */
const TOKEN_RE =
  /^p\.([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i;

/** Append one platform audit entry (append-only table). */
export function platformAudit(
  tx: Tx,
  entry: {
    actorId: string | null;
    action: string;
    officeId?: string | null;
    details?: Record<string, unknown>;
    ip?: string | null;
    requestId?: string | null;
  },
) {
  return tx.insert(platformAuditLog).values({
    actorId: entry.actorId,
    createdBy: entry.actorId,
    action: entry.action,
    officeId: entry.officeId ?? null,
    details: entry.details ?? null,
    ip: entry.ip ?? null,
    requestId: entry.requestId ?? null,
  });
}

/**
 * إدارة المنصة sessions: a revocable row, short-lived, re-checked on every
 * request (the admin must still be active and, when set, signing in from an
 * allowed address).
 */
@Injectable()
export class PlatformSessionService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(tx: Tx, adminId: string, meta: PlatformMeta): Promise<string> {
    const secret = newSessionSecret();
    const now = Date.now();
    const [row] = await tx
      .insert(platformSessions)
      .values({
        adminId,
        tokenHash: sha256(secret),
        expiresAt: new Date(now + PLATFORM_SESSION_POLICY.absoluteTtlMs),
        lastSeenAt: new Date(now),
        ip: meta.ip,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
      })
      .returning({ id: platformSessions.id });
    return `p.${row!.id}.${secret}`;
  }

  ipAllowed(ip: string): boolean {
    return (
      this.env.PLATFORM_IP_ALLOWLIST.length === 0 || isIpAllowed(ip, this.env.PLATFORM_IP_ALLOWLIST)
    );
  }

  async resolve(
    token: string,
    ip: string,
  ): Promise<{ sessionId: string; principal: PlatformPrincipal } | null> {
    const m = TOKEN_RE.exec(token);
    if (!m?.[1] || !m[2] || !this.ipAllowed(ip)) return null;
    const sessionId = m[1].toLowerCase();
    const secret = m[2];
    return withPlatform(this.db, async (tx) => {
      const [row] = await tx
        .select({
          s: platformSessions,
          active: platformAdmins.isActive,
          activatedAt: platformAdmins.activatedAt,
          role: platformAdmins.role,
        })
        .from(platformSessions)
        .innerJoin(platformAdmins, eq(platformAdmins.id, platformSessions.adminId))
        .where(and(eq(platformSessions.id, sessionId), isNull(platformAdmins.deletedAt)));
      const now = new Date();
      if (!row || !row.active || !row.activatedAt) return null;
      if (!sameDigest(row.s.tokenHash, sha256(secret))) return null;
      if (!isSessionLive(row.s, now, PLATFORM_SESSION_POLICY)) return null;
      if (now.getTime() - row.s.lastSeenAt.getTime() >= PLATFORM_SESSION_POLICY.touchIntervalMs)
        await tx
          .update(platformSessions)
          .set({ lastSeenAt: now })
          .where(eq(platformSessions.id, sessionId));
      // The role is read fresh on every request, so a change applies at once.
      return { sessionId, principal: { adminId: row.s.adminId, role: row.role } };
    });
  }

  /** End every open session of a member (disabled, or a new activation link). */
  revokeAll(tx: Tx, adminId: string) {
    return tx
      .update(platformSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(platformSessions.adminId, adminId), isNull(platformSessions.revokedAt)));
  }

  revoke(sessionId: string) {
    return withPlatform(this.db, (tx) =>
      tx
        .update(platformSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(platformSessions.id, sessionId), isNull(platformSessions.revokedAt))),
    );
  }
}

/** Where activation links point: WEB_ORIGIN, else the first allowed origin. */
export function webOrigin(env: Env): string {
  return (env.WEB_ORIGIN ?? env.CORS_ORIGINS[0] ?? "http://localhost:3000").replace(/\/$/, "");
}

/** `•••• 1234`: enough to recognise a number, not to read it. */
export function maskPhone(phone: string): string {
  return `•••• ${phone.slice(-4)}`;
}

/** The OTP hash for platform codes (the same for sign-in and activation). */
export function platformOtpHash(env: Env, phone: string, code: string): string {
  return hashOtpCode(env.AUTH_SECRET, `platform:${phone}`, code);
}
