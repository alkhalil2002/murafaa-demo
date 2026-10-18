import { Inject, Injectable } from "@nestjs/common";
import { ErrorCode } from "@murafaa/contracts";
import { offices, users } from "@murafaa/database";
import { eq } from "drizzle-orm";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import { isIpAllowed, isValidIpEntry } from "../../common/security/ip-allowlist.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { ENV, type Env } from "../../config/env.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { decryptSecret, encryptSecret } from "../auth/auth-crypto.js";
import { generateTotpSecret, totpUri, verifyTotpCode } from "../auth/totp.js";

type Meta = { ip: string; requestId: string };

/** How long a TOTP secret waits for its confirming code. */
const ENROLLMENT_TTL_MS = 10 * 60 * 1000;

/**
 * Personal account security (legacy server/security.ts). Every user manages
 * only their own row. Improvements over legacy: the pending secret stays on
 * the server (encrypted), disabling 2FA needs a current code, and the office
 * IP allowlist is validated and can't lock out the partner saving it.
 */
@Injectable()
export class SecurityService {
  constructor(
    private readonly tenantDb: TenantDb,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async status(p: Principal) {
    const [row] = await this.tenantDb.run((tx) =>
      tx
        .select({ totpEnabled: users.totpEnabled, phone: users.phone })
        .from(users)
        .where(eq(users.id, p.userId)),
    );
    if (!row) throw new ApiException(ErrorCode.NOT_FOUND);
    return row;
  }

  /** Start enrollment: a fresh secret, stored encrypted as pending until confirmed. */
  async beginTotp(p: Principal) {
    return this.tenantDb.run(async (tx) => {
      const [user] = await tx
        .select({ phone: users.phone, totpEnabled: users.totpEnabled })
        .from(users)
        .where(eq(users.id, p.userId));
      if (!user) throw new ApiException(ErrorCode.NOT_FOUND);
      if (user.totpEnabled) throw new ApiException(ErrorCode.CONFLICT);
      const secret = generateTotpSecret();
      await tx
        .update(users)
        .set({
          totpPendingEnc: encryptSecret(this.env.ENCRYPTION_KEY, secret),
          totpPendingExpiresAt: new Date(Date.now() + ENROLLMENT_TTL_MS),
          updatedBy: p.userId,
        })
        .where(eq(users.id, p.userId));
      return { secret, uri: totpUri(secret, user.phone) };
    });
  }

  /** Confirm enrollment with one code from the app; only then is 2FA turned on. */
  async confirmTotp(p: Principal, code: string, meta: Meta) {
    await this.tenantDb.run(async (tx) => {
      const [user] = await tx
        .select({ pending: users.totpPendingEnc, expiresAt: users.totpPendingExpiresAt })
        .from(users)
        .where(eq(users.id, p.userId));
      if (!user?.pending || !user.expiresAt || user.expiresAt.getTime() < Date.now()) {
        throw new ApiException(ErrorCode.OTP_EXPIRED, undefined, "security.totp.expired");
      }
      if (!verifyTotpCode(decryptSecret(this.env.ENCRYPTION_KEY, user.pending), code)) {
        throw new ApiException(ErrorCode.TOTP_INVALID, undefined, "security.totp.invalidCode");
      }
      await tx
        .update(users)
        .set({
          totpSecretEnc: user.pending,
          totpEnabled: true,
          totpPendingEnc: null,
          totpPendingExpiresAt: null,
          updatedBy: p.userId,
        })
        .where(eq(users.id, p.userId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "security.totp.enable",
        entity: "users",
        entityId: p.userId,
        ...meta,
      });
    });
  }

  /** Turn 2FA off; requires a current code so an unattended open session can't do it. */
  async disableTotp(p: Principal, code: string, meta: Meta) {
    await this.tenantDb.run(async (tx) => {
      const [user] = await tx
        .select({ secret: users.totpSecretEnc, enabled: users.totpEnabled })
        .from(users)
        .where(eq(users.id, p.userId));
      if (!user?.enabled || !user.secret) throw new ApiException(ErrorCode.CONFLICT);
      if (!verifyTotpCode(decryptSecret(this.env.ENCRYPTION_KEY, user.secret), code)) {
        throw new ApiException(ErrorCode.TOTP_INVALID, undefined, "security.totp.invalidCode");
      }
      await tx
        .update(users)
        .set({ totpSecretEnc: null, totpEnabled: false, updatedBy: p.userId })
        .where(eq(users.id, p.userId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "security.totp.disable",
        entity: "users",
        entityId: p.userId,
        ...meta,
      });
    });
  }

  async ipAllowlist(p: Principal): Promise<string[]> {
    const [row] = await this.tenantDb.run((tx) =>
      tx.select({ list: offices.ipAllowlist }).from(offices).where(eq(offices.id, p.officeId)),
    );
    return row?.list ?? [];
  }

  /** Replace the office IP allowlist (partner only, enforced by the controller). */
  async setIpAllowlist(p: Principal, entries: string[], meta: Meta): Promise<string[]> {
    const cleaned = [...new Set(entries.map((e) => e.trim()).filter(Boolean))];
    const invalid = cleaned
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => !isValidIpEntry(entry))
      .map(({ index }) => ({ path: `entries.${index}`, message: "security.ip.invalidEntry" }));
    if (invalid.length) throw new ApiException(ErrorCode.VALIDATION_FAILED, invalid);
    // Saving a list that excludes the caller's own address would lock them out on the next request.
    if (!isIpAllowed(meta.ip, cleaned))
      throw new ApiException(ErrorCode.CONFLICT, undefined, "errors.IP_LOCKOUT");

    await this.tenantDb.run(async (tx) => {
      await tx
        .update(offices)
        .set({ ipAllowlist: cleaned, updatedBy: p.userId })
        .where(eq(offices.id, p.officeId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "security.ipAllowlist.update",
        entity: "offices",
        entityId: p.officeId,
        after: { entries: cleaned.length },
        ...meta,
      });
    });
    return cleaned;
  }
}
