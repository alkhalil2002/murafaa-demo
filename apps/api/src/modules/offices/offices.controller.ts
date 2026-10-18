import { Controller, Get, Put, Req } from "@nestjs/common";
import { ErrorCode, type Office, office, officeBranding } from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { Authenticated, RequirePartner } from "../../common/permissions/permission.decorators.js";
import { ZodBody, ZodResponse } from "../../common/zod/zod.decorators.js";
import { OfficesService } from "./offices.service.js";

@Controller("offices")
export class OfficesController {
  constructor(private readonly offices: OfficesService) {}

  @Authenticated()
  @Get("current")
  @ZodResponse(office)
  current(): Promise<Office> {
    return this.offices.current();
  }

  /** Everyone may read the letterhead branding; only partners change it. */
  @Authenticated()
  @Get("branding")
  @ZodResponse(officeBranding)
  branding() {
    return this.offices.branding();
  }

  @RequirePartner("office.branding.update")
  @Put("branding")
  @ZodResponse(officeBranding)
  updateBranding(
    @ZodBody(officeBranding) body: z.infer<typeof officeBranding>,
    @Req() req: FastifyRequest,
  ) {
    if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
    return this.offices.updateBranding(req.principal, body, {
      ip: req.ip,
      requestId: String(req.id),
    });
  }
}
