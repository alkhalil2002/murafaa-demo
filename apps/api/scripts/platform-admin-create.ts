import { parseArgs } from "node:util";
import { createDb, platformAdmins, withPlatform } from "@murafaa/database";
import { normalizeSaudiPhone } from "@murafaa/rules";
import { loadEnv } from "../src/config/env.js";
import { encryptSecret } from "../src/modules/auth/auth-crypto.js";
import { generateTotpSecret, totpUri } from "../src/modules/auth/totp.js";
import { platformAudit } from "../src/modules/platform/platform-session.service.js";

/**
 * Create a إدارة المنصة operator. Run by whoever runs the platform, never
 * from a web page:
 *
 *   pnpm --filter @murafaa/api platform:admin:create --name "نورة" --phone 05XXXXXXXX
 *
 * Prints the authenticator (TOTP) enrolment URI once; it is required at
 * every sign-in and is not shown again.
 */
const { values } = parseArgs({
  options: { name: { type: "string" }, phone: { type: "string" } },
});
const name = values.name?.trim();
const phone = values.phone ? normalizeSaudiPhone(values.phone) : null;
if (!name || !phone) {
  console.error('usage: platform:admin:create --name "<name>" --phone 05XXXXXXXX');
  process.exit(1);
}

const env = loadEnv(process.env);
const { db, close } = createDb(env.DATABASE_URL, { max: 1 });
try {
  const secret = generateTotpSecret();
  await withPlatform(db, async (tx) => {
    const [row] = await tx
      .insert(platformAdmins)
      .values({ name, phone, totpSecretEnc: encryptSecret(env.ENCRYPTION_KEY, secret) })
      .returning({ id: platformAdmins.id });
    await platformAudit(tx, {
      actorId: null,
      action: "platform.admin.create",
      details: { adminId: row!.id },
    });
  });
  console.log(`Platform admin created: ${name} (${phone})`);
  console.log("Add this to an authenticator app now; it is not shown again:");
  console.log(totpUri(secret, phone, "Murafaa Platform"));
} finally {
  await close();
}
