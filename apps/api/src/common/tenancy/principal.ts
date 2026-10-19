import type { Role } from "@murafaa/auth";

/** The authenticated caller. Set on the request by the auth layer (OTP sessions, next milestone). */
export type Principal = {
  userId: string;
  officeId: string;
  role: Role;
  /** Set while a partner previews another role ("معاينة حسب الدور"). */
  previewRole?: Role | null;
  /** The office is suspended by إدارة المنصة: everything is read-only. */
  officeReadOnly?: boolean;
};

/**
 * A client or employee signed in to their portal. Never a staff principal:
 * it carries no role and reaches only routes marked @PortalRoute(kind).
 */
export type PortalPrincipal = {
  kind: "CLIENT" | "EMPLOYEE";
  /** The client or employee id. */
  subjectId: string;
  officeId: string;
  /** The office is suspended: the portal is read-only. */
  officeReadOnly?: boolean;
};

/**
 * A Murafaa platform operator (إدارة المنصة). Belongs to no office and
 * reaches only routes marked @PlatformRoute(); it has no tenant scope at all.
 */
export type PlatformPrincipal = { adminId: string };

declare module "fastify" {
  interface FastifyRequest {
    portal?: PortalPrincipal;
    portalSessionId?: string;
    platform?: PlatformPrincipal;
    platformSessionId?: string;
    principal?: Principal;
    /** The session behind `principal`, for logout and role preview. */
    sessionId?: string;
    /** Why a presented session was not accepted, so the guard can answer precisely. */
    sessionRejected?: "IP_NOT_ALLOWED" | "ORIGIN";
  }
}
