import { Controller, Get, Req } from "@nestjs/common";
import { PermModule } from "@murafaa/auth";
import { ErrorCode, whatsappLog } from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import { ApiException } from "../../common/http/api.exception.js";
import { RequirePermission } from "../../common/permissions/permission.decorators.js";
import { ZodResponse } from "../../common/zod/zod.decorators.js";
import { CaseworkService } from "../cases/casework.service.js";

/** واتساب (docs/04 module WHATSAPP). Not connected to WhatsApp: the log staff recorded. */
@Controller("whatsapp")
export class WhatsappController {
  constructor(private readonly casework: CaseworkService) {}

  @RequirePermission(PermModule.WHATSAPP, "view")
  @Get("messages")
  @ZodResponse(whatsappLog)
  messages(@Req() req: FastifyRequest) {
    if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
    return this.casework.messageLog(req.principal);
  }
}
