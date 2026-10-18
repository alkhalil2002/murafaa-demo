import { Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { PermModule } from "@murafaa/auth";
import {
  appointmentList,
  createAppointmentBody,
  createdCase,
  ErrorCode,
  idParams,
} from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { RequirePermission } from "../../common/permissions/permission.decorators.js";
import { ZodBody, ZodParams, ZodResponse } from "../../common/zod/zod.decorators.js";
import { AppointmentsService } from "./appointments.service.js";

function caller(req: FastifyRequest) {
  if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return { p: req.principal, meta: { ip: req.ip, requestId: String(req.id) } };
}

/** المواعيد (docs/04 module APPOINTMENTS). */
@Controller("appointments")
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @RequirePermission(PermModule.APPOINTMENTS, "view")
  @Get()
  @ZodResponse(appointmentList)
  list() {
    return this.appointments.list();
  }

  @RequirePermission(PermModule.APPOINTMENTS, "edit")
  @Post()
  @ZodResponse(createdCase)
  create(
    @ZodBody(createAppointmentBody) body: z.infer<typeof createAppointmentBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.appointments.create(p, body, meta);
  }

  @RequirePermission(PermModule.APPOINTMENTS, "edit")
  @Post(":id/cancel")
  @HttpCode(200)
  async cancel(@ZodParams(idParams) params: z.infer<typeof idParams>, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.appointments.cancel(p, params.id, meta);
    return null;
  }
}
