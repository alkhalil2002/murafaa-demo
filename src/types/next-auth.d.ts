import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/** Augment Auth.js types with our tenant + role claims. */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      officeId: string;
      role: Role;
      phone: string;
    } & DefaultSession["user"];
  }

  interface User {
    officeId: string;
    role: Role;
    phone: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    officeId?: string;
    role?: Role;
    phone?: string;
  }
}
