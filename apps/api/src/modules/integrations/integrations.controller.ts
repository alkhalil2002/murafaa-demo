import { Controller, Get, Req } from "@nestjs/common";
import { ErrorCode, integrationList } from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import { ApiException } from "../../common/http/api.exception.js";
import { Authenticated } from "../../common/permissions/permission.decorators.js";
import { ZodResponse } from "../../common/zod/zod.decorators.js";
import { IntegrationsService } from "./integrations.service.js";

@Controller("integrations")
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  /** Connection status only (no credentials, no data): every signed-in user may see it. */
  @Authenticated()
  @Get()
  @ZodResponse(integrationList)
  list(@Req() req: FastifyRequest) {
    if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
    return this.integrations.list(req.principal);
  }
}
