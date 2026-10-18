import { Inject, Injectable } from "@nestjs/common";
import { isSessionLive, PORTAL_SESSION_POLICY } from "@murafaa/auth";
import {
  clients,
  type Db,
  employees,
  portalSessions,
  type Tx,
  withTenant,
} from "@murafaa/database";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { PortalPrincipal } from "../../common/tenancy/principal.js";
import { DB } from "../../database/database.tokens.js";
import {
  formatSessionToken,
  newSessionSecret,
  parseSessionToken,
  sameDigest,
  sha256,
} from "../auth/auth-crypto.js";

export type PortalKind = PortalPrincipal["kind"];

/** One cookie per portal, so a client portal session never answers on the employee portal. */
export const PORTAL_COOKIE: Record<PortalKind, string> = {
  CLIENT: "murafaa_portal",
  EMPLOYEE: "murafaa_emp_portal",
};

/**
 * Portal sessions: a revocable row per sign-in, checked on every request.
 * The subject must still be allowed in (an ACTIVE client; an ACTIVE or
 * ON_LEAVE employee), so deactivating them ends their access at once
 * (legacy's signed cookie stayed valid for 7 days).
 */
@Injectable()
export class PortalSessionService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(
    tx: Tx,
    input: {
      officeId: string;
      kind: PortalKind;
      subjectId: string;
      ip: string;
      userAgent: string | null;
    },
  ): Promise<string> {
    const secret = newSessionSecret();
    const now = Date.now();
    const [row] = await tx
      .insert(portalSessions)
      .values({
        officeId: input.officeId,
        kind: input.kind,
        subjectId: input.subjectId,
        tokenHash: sha256(secret),
        expiresAt: new Date(now + PORTAL_SESSION_POLICY.absoluteTtlMs),
        lastSeenAt: new Date(now),
        ip: input.ip,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
      })
      .returning({ id: portalSessions.id });
    return formatSessionToken(input.officeId, row!.id, secret);
  }

  /** Whether the client or employee may still use the portal. */
  async subjectAllowed(tx: Tx, kind: PortalKind, subjectId: string): Promise<boolean> {
    if (kind === "CLIENT") {
      const [c] = await tx
        .select({ id: clients.id })
        .from(clients)
        .where(
          and(eq(clients.id, subjectId), eq(clients.status, "ACTIVE"), isNull(clients.deletedAt)),
        );
      return Boolean(c);
    }
    const [e] = await tx
      .select({ id: employees.id })
      .from(employees)
      .where(
        and(
          eq(employees.id, subjectId),
          inArray(employees.status, ["ACTIVE", "ON_LEAVE"]),
          isNull(employees.deletedAt),
        ),
      );
    return Boolean(e);
  }

  async resolve(
    token: string,
    kind: PortalKind,
  ): Promise<{ sessionId: string; principal: PortalPrincipal } | null> {
    const parsed = parseSessionToken(token);
    if (!parsed) return null;
    return withTenant(this.db, parsed.officeId, async (tx) => {
      const [row] = await tx
        .select()
        .from(portalSessions)
        .where(and(eq(portalSessions.id, parsed.sessionId), eq(portalSessions.kind, kind)));
      const now = new Date();
      if (!row || !sameDigest(row.tokenHash, sha256(parsed.secret))) return null;
      if (!isSessionLive(row, now, PORTAL_SESSION_POLICY)) return null;
      if (!(await this.subjectAllowed(tx, kind, row.subjectId))) return null;
      if (now.getTime() - row.lastSeenAt.getTime() >= PORTAL_SESSION_POLICY.touchIntervalMs)
        await tx
          .update(portalSessions)
          .set({ lastSeenAt: now })
          .where(eq(portalSessions.id, row.id));
      return {
        sessionId: row.id,
        principal: { kind, subjectId: row.subjectId, officeId: parsed.officeId },
      };
    });
  }

  revoke(officeId: string, sessionId: string) {
    return withTenant(this.db, officeId, (tx) =>
      tx
        .update(portalSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(portalSessions.id, sessionId), isNull(portalSessions.revokedAt))),
    );
  }
}
