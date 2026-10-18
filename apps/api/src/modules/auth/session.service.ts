import { Inject, Injectable } from "@nestjs/common";
import { isSessionLive, type Role, SESSION_POLICY } from "@murafaa/auth";
import { type Db, offices, sessions, type Tx, users, withTenant } from "@murafaa/database";
import { and, eq, isNull } from "drizzle-orm";
import { isIpAllowed } from "../../common/security/ip-allowlist.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { DB } from "../../database/database.tokens.js";
import {
  formatSessionToken,
  newSessionSecret,
  parseSessionToken,
  sameDigest,
  sha256,
} from "./auth-crypto.js";

export type ResolvedSession = { sessionId: string; principal: Principal };

@Injectable()
export class SessionService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Start a session inside the user's office transaction; returns the client token. */
  async create(
    tx: Tx,
    input: { officeId: string; userId: string; ip: string; userAgent: string | null },
  ): Promise<string> {
    const secret = newSessionSecret();
    const now = Date.now();
    const [row] = await tx
      .insert(sessions)
      .values({
        officeId: input.officeId,
        userId: input.userId,
        tokenHash: sha256(secret),
        expiresAt: new Date(now + SESSION_POLICY.absoluteTtlMs),
        lastSeenAt: new Date(now),
        ip: input.ip,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
        createdBy: input.userId,
      })
      .returning({ id: sessions.id });
    if (!row) throw new Error("session insert returned nothing");
    return formatSessionToken(input.officeId, row.id, secret);
  }

  /**
   * Resolve a token to a principal, or null when invalid, expired, idle too
   * long, revoked, or the user was deactivated. The role is read fresh from
   * the user row, so role changes apply on the next request.
   */
  async resolve(token: string, ip: string): Promise<ResolvedSession | "IP_NOT_ALLOWED" | null> {
    const parsed = parseSessionToken(token);
    if (!parsed) return null;
    return withTenant(this.db, parsed.officeId, async (tx) => {
      const [row] = await tx
        .select({
          tokenHash: sessions.tokenHash,
          expiresAt: sessions.expiresAt,
          lastSeenAt: sessions.lastSeenAt,
          revokedAt: sessions.revokedAt,
          previewRole: sessions.previewRole,
          userId: users.id,
          role: users.role,
          isActive: users.isActive,
          userDeletedAt: users.deletedAt,
          ipAllowlist: offices.ipAllowlist,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .innerJoin(offices, eq(offices.id, sessions.officeId))
        .where(eq(sessions.id, parsed.sessionId))
        .limit(1);

      const now = new Date();
      if (!row || !sameDigest(row.tokenHash, sha256(parsed.secret))) return null;
      if (!isSessionLive(row, now) || !row.isActive || row.userDeletedAt) return null;
      if (!isIpAllowed(ip, row.ipAllowlist)) return "IP_NOT_ALLOWED" as const;

      if (now.getTime() - row.lastSeenAt.getTime() >= SESSION_POLICY.touchIntervalMs) {
        await tx.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, parsed.sessionId));
      }
      const role = row.role as Role;
      return {
        sessionId: parsed.sessionId,
        principal: {
          userId: row.userId,
          officeId: parsed.officeId,
          role,
          // Only a real partner can preview; a stale preview on a demoted user is ignored.
          previewRole: role === "PARTNER" ? ((row.previewRole as Role | null) ?? null) : null,
        },
      };
    });
  }

  async revoke(officeId: string, sessionId: string, by: string): Promise<void> {
    await withTenant(this.db, officeId, (tx) =>
      tx
        .update(sessions)
        .set({ revokedAt: new Date(), updatedBy: by })
        .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt))),
    );
  }
}
