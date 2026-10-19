import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  canModule,
  canPartnerOnly,
  effectiveRole,
  type PartnerOnlyAction,
  previewAllows,
} from "@murafaa/auth";
import { ErrorCode } from "@murafaa/contracts";
import { auditLog, type Db, withTenant } from "@murafaa/database";
import type { FastifyRequest } from "fastify";
import { ENV, type Env } from "../../config/env.js";
import { DB } from "../../database/database.tokens.js";
import { ApiException } from "../http/api.exception.js";
import type { Principal } from "../tenancy/principal.js";
import {
  ALLOW_IN_PREVIEW,
  ALLOW_WHEN_SUSPENDED,
  IS_AUTHENTICATED_ONLY,
  IS_PUBLIC,
  PARTNER_ONLY,
  type PermissionRequirement,
  PLATFORM_ROUTE,
  PORTAL_ROUTE,
  REQUIRED_PERMISSION,
} from "./permission.decorators.js";
import { PolicyService } from "./policy.service.js";

/**
 * Server-side module permission check (docs/04 layer 1, CLAUDE.md guardrail 2)
 * plus partner-only actions. Fails closed: no session → 401; in strict mode a
 * route that declares no permission is denied. Every denial is audited.
 * Decisions use the effective role, so a role preview sees what that role sees.
 */
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly policies: PolicyService,
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    // Platform routes accept only a platform session; office and portal sessions never reach them.
    if (this.reflector.getAllAndOverride<boolean>(PLATFORM_ROUTE, targets)) {
      if (request.platform) return true;
      throw new ApiException(ErrorCode.UNAUTHENTICATED);
    }
    // A suspended office is read-only for everyone in it (owner, 2026-10-19).
    const writeWhileSuspended = (readOnly: boolean | undefined) =>
      readOnly &&
      !READ_METHODS.has(request.method) &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_WHEN_SUSPENDED, targets) &&
      // Sign-out and the role-preview switch change nothing in the office.
      !this.reflector.getAllAndOverride<boolean>(ALLOW_IN_PREVIEW, targets);
    // Portal routes accept only their own portal session; staff sessions do not reach them.
    const portalKind = this.reflector.getAllAndOverride<string | undefined>(PORTAL_ROUTE, targets);
    if (portalKind) {
      if (request.portal?.kind !== portalKind) throw new ApiException(ErrorCode.UNAUTHENTICATED);
      if (writeWhileSuspended(request.portal.officeReadOnly))
        throw new ApiException(ErrorCode.FORBIDDEN, undefined, "errors.OFFICE_SUSPENDED");
      return true;
    }
    const principal = request.principal;
    if (!principal) {
      if (request.sessionRejected === "IP_NOT_ALLOWED")
        throw new ApiException(ErrorCode.IP_NOT_ALLOWED);
      if (request.sessionRejected === "ORIGIN") throw new ApiException(ErrorCode.FORBIDDEN);
      throw new ApiException(ErrorCode.UNAUTHENTICATED);
    }

    if (writeWhileSuspended(principal.officeReadOnly))
      return this.deny(request, principal, "office:suspended", "errors.OFFICE_SUSPENDED");

    const partnerAction = this.reflector.getAllAndOverride<PartnerOnlyAction | undefined>(
      PARTNER_ONLY,
      targets,
    );
    const required = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(
      REQUIRED_PERMISSION,
      targets,
    );

    // Role preview is view-only (docs/05 "معاينة حسب الدور"): every write is
    // blocked whatever either role may do. Starting/ending the preview itself
    // is the only exception.
    if (
      principal.previewRole &&
      partnerAction !== "rolePreview.start" &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_IN_PREVIEW, targets) &&
      (!READ_METHODS.has(request.method) ||
        (required && !previewAllows(principal, required.action)))
    ) {
      return this.deny(request, principal, "preview:view-only");
    }

    if (partnerAction) {
      if (canPartnerOnly(principal, partnerAction)) return true;
      return this.deny(request, principal, `partner:${partnerAction}`);
    }
    if (!required) {
      if (this.reflector.getAllAndOverride<boolean>(IS_AUTHENTICATED_ONLY, targets)) return true;
      if (this.env.RBAC_ENFORCEMENT === "permissive") return true;
      return this.deny(request, principal, "undeclared");
    }

    const policy = await this.policies.forOffice(principal.officeId);
    if (canModule(policy, effectiveRole(principal), required.module, required.action)) return true;
    return this.deny(request, principal, `${required.module}:${required.action}`);
  }

  private async deny(
    request: FastifyRequest,
    principal: Principal,
    reason: string,
    messageKey?: string,
  ): Promise<never> {
    try {
      await withTenant(this.db, principal.officeId, (tx) =>
        tx.insert(auditLog).values({
          officeId: principal.officeId,
          actorId: principal.userId,
          createdBy: principal.userId,
          action: "permission.denied",
          entity: "route",
          after: { method: request.method, url: request.url, reason },
          ip: request.ip,
          requestId: String(request.id),
        }),
      );
    } catch (error) {
      // The denial stands even if the audit write fails.
      this.logger.error({ err: error }, "failed to audit permission denial");
    }
    throw new ApiException(ErrorCode.FORBIDDEN, undefined, messageKey);
  }
}
