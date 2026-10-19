import { parseArgs } from "node:util";
import { createDb, platformAdmins, platformSessions, withPlatform } from "@murafaa/database";
import { qrTerminal } from "@murafaa/documents";
import { normalizeSaudiPhone } from "@murafaa/rules";
import { and, eq, isNull } from "drizzle-orm";
import { loadEnv } from "../src/config/env.js";
import { encryptSecret } from "../src/modules/auth/auth-crypto.js";
import { generateTotpSecret, totpUri } from "../src/modules/auth/totp.js";
import { platformAudit } from "../src/modules/platform/platform-session.service.js";

/**
 * Create a إدارة المنصة operator. Run by whoever runs the platform, never
 * from a web page:
 *
 *   pnpm platform:admin:create --name "نورة" --phone 05XXXXXXXX
 *
 * An operator who lost their authenticator gets a new secret (the old one
 * stops working and their open sessions end):
 *
 *   pnpm platform:admin:create --phone 05XXXXXXXX --reset-totp
 *
 * Prints the authenticator (TOTP) enrolment QR and setup key once; it is required at
 * every sign-in and is not shown again.
 */
const { values } = parseArgs({
  options: {
    name: { type: "string" },
    phone: { type: "string" },
    "reset-totp": { type: "boolean", default: false },
  },
});
const reset = values["reset-totp"] === true;
const name = values.name?.trim();
const phone = values.phone ? normalizeSaudiPhone(values.phone) : null;
if (!phone || (!reset && !name)) {
  console.error('usage: platform:admin:create --name "<name>" --phone 05XXXXXXXX');
  console.error("       platform:admin:create --phone 05XXXXXXXX --reset-totp");
  process.exit(1);
}

const env = loadEnv(process.env);
const { db, close } = createDb(env.DATABASE_URL, { max: 1 });
try {
  const secret = generateTotpSecret();
  const totpSecretEnc = encryptSecret(env.ENCRYPTION_KEY, secret);
  const outcome = await withPlatform(db, async (tx) => {
    const [existing] = await tx
      .select({ id: platformAdmins.id, name: platformAdmins.name })
      .from(platformAdmins)
      .where(and(eq(platformAdmins.phone, phone), isNull(platformAdmins.deletedAt)));
    if (reset) {
      if (!existing) return "NOT_FOUND" as const;
      await tx
        .update(platformAdmins)
        .set({ totpSecretEnc, ...(name ? { name } : {}) })
        .where(eq(platformAdmins.id, existing.id));
      await tx
        .update(platformSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(platformSessions.adminId, existing.id), isNull(platformSessions.revokedAt)));
      await platformAudit(tx, {
        actorId: null,
        action: "platform.admin.resetTotp",
        details: { adminId: existing.id },
      });
      return `Authenticator reset for ${name ?? existing.name} (${phone}); open sessions ended.`;
    }
    if (existing) return "EXISTS" as const;
    const [row] = await tx
      .insert(platformAdmins)
      .values({ name: name!, phone, totpSecretEnc })
      .returning({ id: platformAdmins.id });
    await platformAudit(tx, {
      actorId: null,
      action: "platform.admin.create",
      details: { adminId: row!.id },
    });
    return `Platform admin created: ${name} (${phone})`;
  });
  if (outcome === "EXISTS" || outcome === "NOT_FOUND") {
    console.error(
      outcome === "EXISTS"
        ? `${phone} is already a platform admin. To issue a new authenticator secret, add --reset-totp.`
        : `${phone} is not a platform admin.`,
    );
    process.exitCode = 1;
  } else {
    console.log(outcome);
    const uri = totpUri(secret, phone, "Murafaa Platform");
    console.log("Scan this with an authenticator app now; it is not shown again:\n");
    console.log(qrTerminal(uri));
    console.log(`Or enter the setup key by hand: ${secret}`);
  }
} finally {
  await close();
}
