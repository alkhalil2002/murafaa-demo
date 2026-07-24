import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./config";
import { verifyOtp } from "./otp";

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
      },
      async authorize(raw) {
        const phone = typeof raw?.phone === "string" ? raw.phone : "";
        const code = typeof raw?.code === "string" ? raw.code : "";
        if (!phone || !code) return null;

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
