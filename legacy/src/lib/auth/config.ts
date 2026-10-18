import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Edge-safe Auth.js config. Contains ONLY things that run in the Edge runtime
 * (middleware): session strategy, pages, and the pure jwt/session callbacks.
 * The Credentials provider — which pulls in node:crypto and Prisma — lives in
 * ./index.ts and must never be imported by middleware.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  // Providers are added in ./index.ts (Node runtime only).
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.officeId = (user as { officeId: string }).officeId;
        token.role = (user as { role: Role }).role;
        token.phone = (user as { phone: string }).phone;
        token.name = user.name ?? token.name;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.officeId = token.officeId as string;
      session.user.role = token.role as Role;
      session.user.phone = token.phone as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
