import { Inject, Injectable } from "@nestjs/common";
import { PLATFORM_INVITE_TTL_MS } from "@murafaa/auth";
import {
  ErrorCode,
  type platformInviteBody,
  type platformUpdateMemberBody,
} from "@murafaa/contracts";
import { type Db, platformAdmins, platformInvites, type Tx, withPlatform } from "@murafaa/database";
import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import type { PlatformPrincipal } from "../../common/tenancy/principal.js";
import { ENV, type Env } from "../../config/env.js";
import { DB } from "../../database/database.tokens.js";
import { newSessionSecret, sha256 } from "../auth/auth-crypto.js";
import {
  maskPhone,
  platformAudit,
  type PlatformMeta,
  PlatformSessionService,
  webOrigin,
} from "./platform-session.service.js";

const conflict = (key: string) => new ApiException(ErrorCode.CONFLICT, undefined, key);

/**
 * فريق المنصة (team.manage, owner only): invite members with a role, change
 * roles, disable them, issue a new activation link. There is always at least
 * one active owner, and nobody changes their own role or access.
 */
@Injectable()
export class PlatformTeamService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly sessions: PlatformSessionService,
  ) {}

  /** A fresh one-time link; any older unused link of the member stops working. */
  async issueInvite(tx: Tx, adminId: string, by: string | null) {
    await tx
      .update(platformInvites)
      .set({ consumedAt: new Date() })
      .where(and(eq(platformInvites.adminId, adminId), isNull(platformInvites.consumedAt)));
    const token = newSessionSecret();
    const expiresAt = new Date(Date.now() + PLATFORM_INVITE_TTL_MS);
    await tx
      .insert(platformInvites)
      .values({ adminId, tokenHash: sha256(token), expiresAt, createdBy: by });
    return {
      id: adminId,
      link: `${webOrigin(this.env)}/platform/activate#${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  list(who: PlatformPrincipal) {
    return withPlatform(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(platformAdmins)
        .where(isNull(platformAdmins.deletedAt))
        .orderBy(asc(platformAdmins.createdAt));
      return rows.map((a) => ({
        id: a.id,
        name: a.name,
        phone: maskPhone(a.phone),
        role: a.role,
        status: !a.isActive
          ? ("DISABLED" as const)
          : a.activatedAt
            ? ("ACTIVE" as const)
            : ("PENDING" as const),
        lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
        isSelf: a.id === who.adminId,
      }));
    });
  }

  invite(who: PlatformPrincipal, input: z.infer<typeof platformInviteBody>, meta: PlatformMeta) {
    return withPlatform(this.db, async (tx) => {
      const [taken] = await tx
        .select({ id: platformAdmins.id })
        .from(platformAdmins)
        .where(and(eq(platformAdmins.phone, input.phone), isNull(platformAdmins.deletedAt)));
      if (taken) throw conflict("platform.err.PHONE_TAKEN");
      const [a] = await tx
        .insert(platformAdmins)
        .values({ name: input.name, phone: input.phone, role: input.role, createdBy: who.adminId })
        .returning({ id: platformAdmins.id });
      const link = await this.issueInvite(tx, a!.id, who.adminId);
      await platformAudit(tx, {
        actorId: who.adminId,
        action: "platform.invite.create",
        details: { adminId: a!.id, role: input.role },
        ip: meta.ip,
        requestId: meta.requestId,
      });
      return link;
    });
  }

  /** Active owners other than `except`, locked so two changes can't both pass the count. */
  private async otherOwners(tx: Tx, except: string) {
    const owners = await tx
      .select({ id: platformAdmins.id })
      .from(platformAdmins)
      .where(
        and(
          eq(platformAdmins.role, "OWNER"),
          eq(platformAdmins.isActive, true),
          isNotNull(platformAdmins.activatedAt),
          isNull(platformAdmins.deletedAt),
        ),
      )
      .for("update");
    return owners.filter((o) => o.id !== except).length;
  }

  private async target(tx: Tx, who: PlatformPrincipal, id: string) {
    if (id === who.adminId) throw conflict("platform.err.SELF");
    const [a] = await tx
      .select()
      .from(platformAdmins)
      .where(and(eq(platformAdmins.id, id), isNull(platformAdmins.deletedAt)))
      .for("update");
    if (!a) throw new ApiException(ErrorCode.NOT_FOUND);
    return a;
  }

  update(
    who: PlatformPrincipal,
    id: string,
    input: z.infer<typeof platformUpdateMemberBody>,
    meta: PlatformMeta,
  ) {
    return withPlatform(this.db, async (tx) => {
      const a = await this.target(tx, who, id);
      const losesOwner =
        a.role === "OWNER" &&
        a.isActive &&
        ((input.role !== undefined && input.role !== "OWNER") || input.isActive === false);
      if (losesOwner && (await this.otherOwners(tx, a.id)) === 0)
        throw conflict("platform.err.LAST_OWNER");
      await tx
        .update(platformAdmins)
        .set({
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          updatedBy: who.adminId,
        })
        .where(eq(platformAdmins.id, a.id));
      if (input.isActive === false) await this.sessions.revokeAll(tx, a.id);
      await platformAudit(tx, {
        actorId: who.adminId,
        action:
          input.isActive === false
            ? "platform.member.disable"
            : input.isActive === true && !a.isActive
              ? "platform.member.enable"
              : "platform.member.role",
        details: { adminId: a.id, role: input.role ?? a.role },
        ip: meta.ip,
        requestId: meta.requestId,
      });
    });
  }

  /**
   * A new activation link (lost phone): the old authenticator stops working,
   * open sessions end, and the member signs in again only after activating.
   */
  reset(who: PlatformPrincipal, id: string, meta: PlatformMeta) {
    return withPlatform(this.db, async (tx) => {
      const a = await this.target(tx, who, id);
      if (!a.isActive) throw conflict("platform.err.DISABLED");
      await tx
        .update(platformAdmins)
        .set({ totpSecretEnc: null, activatedAt: null, updatedBy: who.adminId })
        .where(eq(platformAdmins.id, a.id));
      await this.sessions.revokeAll(tx, a.id);
      const link = await this.issueInvite(tx, a.id, who.adminId);
      await platformAudit(tx, {
        actorId: who.adminId,
        action: "platform.invite.reset",
        details: { adminId: a.id },
        ip: meta.ip,
        requestId: meta.requestId,
      });
      return link;
    });
  }
}
