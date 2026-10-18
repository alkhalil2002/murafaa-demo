import { Controller, Get, HttpCode, Post, Put, Req } from "@nestjs/common";
import { PermModule } from "@murafaa/auth";
import {
  ErrorCode,
  idParams,
  kindParams,
  pulseDrill,
  pulseQuery,
  pulseSelf,
  pulseTeam,
  pulseWeights,
  setWeightBody,
} from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import {
  Authenticated,
  RequirePermission,
} from "../../common/permissions/permission.decorators.js";
import { ZodBody, ZodParams, ZodQuery, ZodResponse } from "../../common/zod/zod.decorators.js";
import { PulseService } from "./pulse.service.js";

function caller(req: FastifyRequest) {
  if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return { p: req.principal, meta: { ip: req.ip, requestId: String(req.id) } };
}

type Query = z.infer<typeof pulseQuery>;

/** نبض الفريق (docs/04 module PULSE; docs/05: everyone sees their own card). */
@Controller("pulse")
export class PulseController {
  constructor(private readonly pulse: PulseService) {}

  @Authenticated()
  @Get("self")
  @ZodResponse(pulseSelf)
  self(@ZodQuery(pulseQuery) query: Query, @Req() req: FastifyRequest) {
    return this.pulse.self(caller(req).p, query.window);
  }

  @RequirePermission(PermModule.PULSE, "view")
  @Get("team")
  @ZodResponse(pulseTeam)
  team(@ZodQuery(pulseQuery) query: Query) {
    return this.pulse.team(query.window);
  }

  @RequirePermission(PermModule.PULSE, "view")
  @Get("team/:id")
  @ZodResponse(pulseDrill)
  drill(@ZodParams(idParams) params: z.infer<typeof idParams>, @ZodQuery(pulseQuery) query: Query) {
    return this.pulse.drill(params.id, query.window);
  }

  @RequirePermission(PermModule.PULSE, "view")
  @Get("weights")
  @ZodResponse(pulseWeights)
  weights() {
    return this.pulse.weights();
  }

  @RequirePermission(PermModule.PULSE, "delete")
  @Put("weights/:kind")
  @HttpCode(200)
  async setWeight(
    @ZodParams(kindParams) params: z.infer<typeof kindParams>,
    @ZodBody(setWeightBody) body: z.infer<typeof setWeightBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.pulse.setWeight(p, params.kind, body.points, meta);
    return null;
  }

  @RequirePermission(PermModule.PULSE, "delete")
  @Post("weights/:kind/reset")
  @HttpCode(200)
  async resetWeight(
    @ZodParams(kindParams) params: z.infer<typeof kindParams>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.pulse.resetWeight(p, params.kind, meta);
    return null;
  }
}
