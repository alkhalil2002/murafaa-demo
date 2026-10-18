import type { Role } from "@murafaa/auth";

/** The authenticated caller. Set on the request by the auth layer (OTP sessions, next milestone). */
export type Principal = {
  userId: string;
  officeId: string;
  role: Role;
  /** Set while a partner previews another role ("معاينة حسب الدور"). */
  previewRole?: Role | null;
};

declare module "fastify" {
  interface FastifyRequest {
    principal?: Principal;
    /** The session behind `principal`, for logout and role preview. */
    sessionId?: string;
    /** Why a presented session was not accepted, so the guard can answer precisely. */
    sessionRejected?: "IP_NOT_ALLOWED" | "ORIGIN";
  }
}
