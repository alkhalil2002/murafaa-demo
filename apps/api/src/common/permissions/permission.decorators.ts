import { SetMetadata } from "@nestjs/common";
import type { PartnerOnlyAction, PermAction, PermModule } from "@murafaa/auth";

export const IS_PUBLIC = "murafaa:public";
export const IS_AUTHENTICATED_ONLY = "murafaa:authenticated";
export const REQUIRED_PERMISSION = "murafaa:permission";
export const PARTNER_ONLY = "murafaa:partner-only";
export const ALLOW_IN_PREVIEW = "murafaa:allow-in-preview";
export const PORTAL_ROUTE = "murafaa:portal";

export type PermissionRequirement = { module: PermModule; action: PermAction };

/** No session required (health checks, OTP login). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

/** Any signed-in user of the office; no module permission (e.g. "my office"). */
export const Authenticated = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_AUTHENTICATED_ONLY, true);

/** The module permission a route needs (docs/04 layer 1). */
export const RequirePermission = (
  module: PermModule,
  action: PermAction,
): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSION, { module, action } satisfies PermissionRequirement);

/** A partner-only action (outside the module matrix; see @murafaa/auth PARTNER_ONLY_ACTIONS). */
export const RequirePartner = (action: PartnerOnlyAction): MethodDecorator & ClassDecorator =>
  SetMetadata(PARTNER_ONLY, action);

/** A write that stays allowed during role preview (sign out, switch or end the preview). */
export const AllowInPreview = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_IN_PREVIEW, true);

/** A client- or employee-portal route: only that portal's session reaches it, never a staff one. */
export const PortalRoute = (kind: "CLIENT" | "EMPLOYEE"): MethodDecorator & ClassDecorator =>
  SetMetadata(PORTAL_ROUTE, kind);
