import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { authConfig } from "./config";
import { verifyOtp } from "./otp";
import { normalizeSaudiPhone } from "./phone";
import { verifyTotpCode } from "./totp";

/**
 * Full Auth.js (v5) instance — Node runtime only (imports node:crypto + Prisma
 * via verifyOtp). Extends the edge-safe authConfig with the OTP Credentials
 * provider. Sessions are JWT (httpOnly cookie) and always carry an explicit
 * office + role — no god mode.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "otp",
      name: "otp",
      credentials: {
        phone: { label: "phone", type: "text" },
        code: { label: "code", type: "text" },
        totp: { label: "totp", type: "text" },
      },
      async authorize(raw) {
        const phone = typeof raw?.phone === "string" ? raw.phone : "";
        const code = typeof raw?.code === "string" ? raw.code : "";
        const totp = typeof raw?.totp === "string" ? raw.totp : "";
        if (!phone || !code) return null;

        // Check the second factor BEFORE consuming the OTP challenge (verifyOtp
        // marks it consumed), so a client that doesn't yet know 2FA is required
        // can retry with the same OTP code once it collects the TOTP field —
        // no wasted/re-sent OTP.
        const normalized = normalizeSaudiPhone(phone);
        if (normalized) {
          const candidates = await prisma.user.findMany({
            where: { phone: normalized, isActive: true, deletedAt: null },
            select: { totpEnabled: true, totpSecret: true },
          });
          const account = candidates.length === 1 ? candidates[0] : null;
          if (account?.totpEnabled && account.totpSecret) {
            if (!totp || !verifyTotpCode(account.totpSecret, totp)) return null;
          }
        }

        const result = await verifyOtp(phone, code);
        if (!result.ok) return null;

        return {
          id: result.user.id,
          officeId: result.user.officeId,
          name: result.user.name,
          phone: result.user.phone,
          role: result.user.role,
        };
      },
    }),
  ],
});
