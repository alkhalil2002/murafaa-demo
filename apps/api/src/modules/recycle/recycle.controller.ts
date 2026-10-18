import { Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { ErrorCode, recycleBin, recycleRestoreParams } from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { Authenticated } from "../../common/permissions/permission.decorators.js";
import { ZodParams, ZodResponse } from "../../common/zod/zod.decorators.js";
import { RecycleService } from "./recycle.service.js";

/** سلة المحذوفات. Per-kind module checks happen in RecycleService. */
@Controller("recycle")
export class RecycleController {
  constructor(private readonly recycle: RecycleService) {}

  @Authenticated()
  @Get()
  @ZodResponse(recycleBin)
  list(@Req() req: FastifyRequest) {
    if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
    return this.recycle.list(req.principal);
  }

  @Authenticated()
  @Post(":kind/:id/restore")
  @HttpCode(200)
  async restore(
    @ZodParams(recycleRestoreParams) params: z.infer<typeof recycleRestoreParams>,
    @Req() req: FastifyRequest,
  ) {
    if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
    await this.recycle.restore(req.principal, params.kind, params.id, {
      ip: req.ip,
      requestId: String(req.id),
    });
    return null;
  }
}
