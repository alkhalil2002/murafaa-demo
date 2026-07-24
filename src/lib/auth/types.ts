import type { Role } from "@prisma/client";

/**
 * The authenticated principal for a request. Every session has an explicit
 * office and role — there is no anonymous "god mode" (docs/04 §6).
 */
export type AppSession = {
  userId: string;
  officeId: string;
  name: string;
  phone: string;
  role: Role;
};
