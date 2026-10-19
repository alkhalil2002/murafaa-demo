import { parseArgs } from "node:util";
import { createDb, platformAdmins, withPlatform } from "@murafaa/database";
import { normalizeSaudiPhone } from "@murafaa/rules";
import { and, eq, isNull } from "drizzle-orm";
import { loadEnv } from "../src/config/env.js";
import {
  platformAudit,
  PlatformSessionService,
} from "../src/modules/platform/platform-session.service.js";
import { PlatformTeamService } from "../src/modules/platform/platform-team.service.js";

/**
 * The first إدارة المنصة owner, run by whoever runs the server. Every other
 * member is invited from the platform's «فريق المنصة» page.
 *
 *   pnpm platform:admin:create --name "المالك" --phone 05XXXXXXXX
 *
 * Prints a one-time activation link (24 h). Send it to the owner: it opens
 * nothing without their phone; they scan the authenticator QR in their own
 * browser, so nobody else ever sees it.
 *
 * An owner who lost their phone (and no other owner can help):
 *
 *   pnpm platform:admin:create --phone 05XXXXXXXX --reset-totp
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
const sessions = new PlatformSessionService(db, env);
const team = new PlatformTeamService(db, env, sessions);
try {
  const outcome = await withPlatform(db, async (tx) => {
    const [existing] = await tx
      .select({ id: platformAdmins.id, name: platformAdmins.name })
      .from(platformAdmins)
      .where(and(eq(platformAdmins.phone, phone), isNull(platformAdmins.deletedAt)));
    if (reset) {
      if (!existing) return "NOT_FOUND" as const;
      await tx
        .update(platformAdmins)
        .set({ totpSecretEnc: null, activatedAt: null, isActive: true, role: "OWNER" })
        .where(eq(platformAdmins.id, existing.id));
      await sessions.revokeAll(tx, existing.id);
      await platformAudit(tx, {
        actorId: null,
        action: "platform.invite.reset",
        details: { adminId: existing.id, via: "cli" },
      });
      const invite = await team.issueInvite(tx, existing.id, null);
      return { message: `New activation link for ${existing.name} (${phone}):`, invite };
    }
    if (existing) return "EXISTS" as const;
    const [row] = await tx
      .insert(platformAdmins)
      .values({ name: name!, phone, role: "OWNER" })
      .returning({ id: platformAdmins.id });
    await platformAudit(tx, {
      actorId: null,
      action: "platform.invite.create",
      details: { adminId: row!.id, role: "OWNER", via: "cli" },
    });
    const invite = await team.issueInvite(tx, row!.id, null);
    return { message: `Platform owner created: ${name} (${phone}). Activation link:`, invite };
  });
  if (outcome === "EXISTS" || outcome === "NOT_FOUND") {
    console.error(
      outcome === "EXISTS"
        ? `${phone} is already a platform member. For a new activation link, add --reset-totp.`
        : `${phone} is not a platform member.`,
    );
    process.exitCode = 1;
  } else {
    console.log(outcome.message);
    console.log(`\n  ${outcome.invite.link}\n`);
    console.log(
      `Valid until ${outcome.invite.expiresAt}, once. It opens only with the owner's phone.`,
    );
  }
} finally {
  await close();
}
