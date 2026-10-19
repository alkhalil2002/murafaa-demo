import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { canPlatform, type PlatformAction, Role } from "@murafaa/auth";
import {
  ErrorCode,
  type platformCreateOfficeBody,
  type platformUpdateOfficeBody,
} from "@murafaa/contracts";
import {
  type Db,
  offices,
  phoneOffices,
  platformAdmins,
  platformAuditLog,
  type PlatformOfficeRow,
  platformOfficeUsers,
  platformOffices,
  platformUpdateOffice,
  seedOfficePolicy,
  type Tx,
  users,
  withPlatform,
} from "@murafaa/database";
import { desc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { PlatformPrincipal } from "../../common/tenancy/principal.js";
import { DB } from "../../database/database.tokens.js";
import { platformAudit, type PlatformMeta } from "./platform-session.service.js";

const conflict = (key: string) => new ApiException(ErrorCode.CONFLICT, undefined, key);

/** Scope the rest of this platform transaction to one office, for writes into it. */
const enterOffice = (tx: Tx, officeId: string) =>
  tx.execute(sql`select set_config('app.office_id', ${officeId}, true)`);

const out = (o: PlatformOfficeRow) => ({
  ...o,
  suspendedAt: o.suspendedAt?.toISOString() ?? null,
  createdAt: o.createdAt.toISOString(),
});

/**
 * إدارة المنصة over offices: list them with counts, create one with its
 * first partner, change status and paid-until. It reads across offices only
 * through platform_api (metadata and counts), never case, client or
 * document content. Every change is audited on the platform and in the office.
 */
@Injectable()
export class PlatformOfficesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  list() {
    return withPlatform(this.db, async (tx) => (await platformOffices(tx)).map(out));
  }

  private async auditRows(tx: Tx, officeId?: string) {
    const names = new Map((await platformOffices(tx)).map((o) => [o.id, o.name]));
    const rows = await tx
      .select({ a: platformAuditLog, actorName: platformAdmins.name })
      .from(platformAuditLog)
      .leftJoin(platformAdmins, eq(platformAdmins.id, platformAuditLog.actorId))
      .where(officeId ? eq(platformAuditLog.officeId, officeId) : undefined)
      .orderBy(desc(platformAuditLog.createdAt))
      .limit(200);
    return rows.map(({ a, actorName }) => ({
      id: a.id,
      action: a.action,
      actorName,
      officeId: a.officeId,
      officeName: a.officeId ? (names.get(a.officeId) ?? null) : null,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  audit() {
    return withPlatform(this.db, (tx) => this.auditRows(tx));
  }

  detail(id: string) {
    return withPlatform(this.db, async (tx) => {
      const o = (await platformOffices(tx)).find((x) => x.id === id);
      if (!o) throw new ApiException(ErrorCode.NOT_FOUND);
      const staff = await platformOfficeUsers(tx, id);
      return {
        ...out(o),
        staff: staff.map((u) => ({
          ...u,
          role: u.role as Role,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        })),
        audit: await this.auditRows(tx, id),
      };
    });
  }

  /**
   * The office, its default permission matrix and its first partner, in one
   * transaction. The partner's phone must not belong to anyone in another
   * office: sign-in could not choose between them (owner, 2026-10-19).
   */
  create(
    who: PlatformPrincipal,
    input: z.infer<typeof platformCreateOfficeBody>,
    meta: PlatformMeta,
  ) {
    return withPlatform(this.db, async (tx) => {
      if ((await phoneOffices(tx, input.ownerPhone)).length > 0)
        throw conflict("errors.PHONE_IN_OTHER_OFFICE");
      const id = randomUUID();
      await enterOffice(tx, id);
      await tx.insert(offices).values({
        id,
        name: input.name,
        city: input.city,
        crNumber: input.crNumber,
        licenseNumber: input.licenseNumber,
        status: input.status,
        trialEndsAt: input.status === "TRIAL" ? input.trialEndsAt : null,
        paidUntil: input.paidUntil,
      });
      await seedOfficePolicy(tx, id);
      const [partner] = await tx
        .insert(users)
        .values({
          officeId: id,
          name: input.ownerName,
          phone: input.ownerPhone,
          role: Role.PARTNER,
        })
        .returning({ id: users.id });
      await writeAudit(tx, {
        officeId: id,
        actorId: null,
        action: "platform.office.create",
        entity: "offices",
        entityId: id,
        after: { partnerId: partner!.id, status: input.status },
        ip: meta.ip,
        requestId: meta.requestId,
      });
      await platformAudit(tx, {
        actorId: who.adminId,
        action: "platform.office.create",
        officeId: id,
        details: { status: input.status },
        ip: meta.ip,
        requestId: meta.requestId,
      });
      return { id };
    });
  }

  update(
    who: PlatformPrincipal,
    id: string,
    input: z.infer<typeof platformUpdateOfficeBody>,
    meta: PlatformMeta,
  ) {
    return withPlatform(this.db, async (tx) => {
      const before = (await platformOffices(tx)).find((o) => o.id === id);
      if (!before) throw new ApiException(ErrorCode.NOT_FOUND);
      // Suspending is an operations decision; the dates are a billing one.
      const needs: PlatformAction[] = [];
      if (input.status !== before.status) needs.push("office.status");
      if (input.paidUntil !== before.paidUntil || input.trialEndsAt !== before.trialEndsAt)
        needs.push("subscription.update");
      const missing = needs.filter((a) => !canPlatform(who.role, a));
      if (missing.length > 0) {
        await platformAudit(tx, {
          actorId: who.adminId,
          action: "platform.denied",
          officeId: id,
          details: { actions: missing },
          ip: meta.ip,
          requestId: meta.requestId,
        });
        return "DENIED" as const;
      }
      await platformUpdateOffice(tx, id, input);
      const action =
        input.status === before.status
          ? "platform.office.update"
          : input.status === "SUSPENDED"
            ? "platform.office.suspend"
            : before.status === "SUSPENDED"
              ? "platform.office.reactivate"
              : "platform.office.status";
      const after = {
        status: input.status,
        paidUntil: input.paidUntil,
        trialEndsAt: input.trialEndsAt,
      };
      await enterOffice(tx, id);
      await writeAudit(tx, {
        officeId: id,
        actorId: null,
        action,
        entity: "offices",
        entityId: id,
        after,
        ip: meta.ip,
        requestId: meta.requestId,
      });
      await platformAudit(tx, {
        actorId: who.adminId,
        action,
        officeId: id,
        details: after,
        ip: meta.ip,
        requestId: meta.requestId,
      });
      return "OK" as const;
    });
  }
}
