import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { Observable } from "rxjs";
import { PORTAL_ROUTE } from "../permissions/permission.decorators.js";
import { tenantContext } from "./tenant-context.js";

/**
 * Runs the handler inside the caller's office so TenantDb can scope queries:
 * the portal principal on portal routes, the staff principal everywhere else
 * (a browser may hold both cookies).
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const portalRoute = this.reflector.getAllAndOverride<string | undefined>(PORTAL_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    const scope = portalRoute ? request.portal : request.principal;
    if (!scope) return next.handle();
    return new Observable((subscriber) =>
      tenantContext.run({ officeId: scope.officeId }, () => next.handle().subscribe(subscriber)),
    );
  }
}
