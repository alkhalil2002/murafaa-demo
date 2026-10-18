import { Controller, Delete, Get, HttpCode, Post, Put, Req } from "@nestjs/common";
import { PermModule } from "@murafaa/auth";
import {
  createdCase,
  createTaskBody,
  ErrorCode,
  idParams,
  moveTaskBody,
  taskList,
} from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { RequirePermission } from "../../common/permissions/permission.decorators.js";
import { ZodBody, ZodParams, ZodResponse } from "../../common/zod/zod.decorators.js";
import { TasksService } from "./tasks.service.js";

function caller(req: FastifyRequest) {
  if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return { p: req.principal, meta: { ip: req.ip, requestId: String(req.id) } };
}

/** المهام board (docs/04 module TASKS). */
@Controller("tasks")
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @RequirePermission(PermModule.TASKS, "view")
  @Get()
  @ZodResponse(taskList)
  list(@Req() req: FastifyRequest) {
    return this.tasks.list(caller(req).p);
  }

  @RequirePermission(PermModule.TASKS, "edit")
  @Post()
  @ZodResponse(createdCase)
  create(
    @ZodBody(createTaskBody) body: z.infer<typeof createTaskBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.tasks.create(p, body, meta);
  }

  @RequirePermission(PermModule.TASKS, "edit")
  @Put(":id/status")
  @HttpCode(200)
  async move(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(moveTaskBody) body: z.infer<typeof moveTaskBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.tasks.move(p, params.id, body.status, meta);
    return null;
  }

  @RequirePermission(PermModule.TASKS, "delete")
  @Delete(":id")
  @HttpCode(200)
  async remove(@ZodParams(idParams) params: z.infer<typeof idParams>, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.tasks.remove(p, params.id, meta);
    return null;
  }
}
