import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Observable } from "rxjs";
import { tenantContext } from "./tenant-context.js";

/** Runs the handler inside the caller's tenant context so TenantDb can scope queries. */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const principal = context.switchToHttp().getRequest<FastifyRequest>().principal;
    if (!principal) return next.handle();
    return new Observable((subscriber) =>
      tenantContext.run(principal, () => next.handle().subscribe(subscriber)),
    );
  }
}
