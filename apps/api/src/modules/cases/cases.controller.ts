import { Controller, Delete, Get, HttpCode, Patch, Post, Put, Req } from "@nestjs/common";
import { PermModule } from "@murafaa/auth";
import {
  assignableUsers,
  assigneeBody,
  caseAssigneeParams,
  caseDetail,
  caseList,
  checklistBody,
  conflictParams,
  createCaseBody,
  createdCase,
  endProcedureBody,
  ErrorCode,
  idParams,
  satisfactionBody,
  setOutcomeBody,
  updateCaseBody,
  waiveConflictBody,
} from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import {
  RequirePartner,
  RequirePermission,
} from "../../common/permissions/permission.decorators.js";
import { ZodBody, ZodParams, ZodResponse } from "../../common/zod/zod.decorators.js";
import { CasesService } from "./cases.service.js";

type Id = z.infer<typeof idParams>;

function caller(req: FastifyRequest) {
  if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return { p: req.principal, meta: { ip: req.ip, requestId: String(req.id) } };
}

/** القضايا (docs/04 module CASES). Row scope is applied inside CasesService. */
@Controller("cases")
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @RequirePermission(PermModule.CASES, "view")
  @Get()
  @ZodResponse(caseList)
  list(@Req() req: FastifyRequest) {
    return this.cases.list(caller(req).p);
  }

  @RequirePermission(PermModule.CASES, "view")
  @Get("assignable-users")
  @ZodResponse(assignableUsers)
  assignable() {
    return this.cases.assignableUsers();
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post()
  @ZodResponse(createdCase)
  create(
    @ZodBody(createCaseBody) body: z.infer<typeof createCaseBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.cases.create(p, body, meta);
  }

  @RequirePermission(PermModule.CASES, "view")
  @Get(":id")
  @ZodResponse(caseDetail)
  detail(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    return this.cases.detail(p, params.id, meta);
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Patch(":id")
  @HttpCode(200)
  async update(
    @ZodParams(idParams) params: Id,
    @ZodBody(updateCaseBody) body: z.infer<typeof updateCaseBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.cases.update(p, params.id, body, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Put(":id/outcome")
  @HttpCode(200)
  async outcome(
    @ZodParams(idParams) params: Id,
    @ZodBody(setOutcomeBody) body: z.infer<typeof setOutcomeBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.cases.setOutcome(p, params.id, body.outcome, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/assignees")
  @HttpCode(200)
  async assign(
    @ZodParams(idParams) params: Id,
    @ZodBody(assigneeBody) body: z.infer<typeof assigneeBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.cases.assign(p, params.id, body.userId, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Delete(":id/assignees/:userId")
  @HttpCode(200)
  async unassign(
    @ZodParams(caseAssigneeParams) params: z.infer<typeof caseAssigneeParams>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.cases.unassign(p, params.id, params.userId, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/stage/promote")
  @HttpCode(200)
  async promote(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.cases.moveStage(p, params.id, 1, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/stage/remand")
  @HttpCode(200)
  async remand(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.cases.moveStage(p, params.id, -1, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/procedure/end")
  @HttpCode(200)
  async endProcedure(
    @ZodParams(idParams) params: Id,
    @ZodBody(endProcedureBody) body: z.infer<typeof endProcedureBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.cases.setProcedureEnded(p, params.id, true, body.result, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/procedure/reopen")
  @HttpCode(200)
  async reopenProcedure(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.cases.setProcedureEnded(p, params.id, false, null, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/closing/checklist")
  @HttpCode(200)
  async checklist(
    @ZodParams(idParams) params: Id,
    @ZodBody(checklistBody) body: z.infer<typeof checklistBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.cases.toggleChecklist(p, params.id, body.key, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Put(":id/satisfaction")
  @HttpCode(200)
  async satisfaction(
    @ZodParams(idParams) params: Id,
    @ZodBody(satisfactionBody) body: z.infer<typeof satisfactionBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.cases.setSatisfaction(p, params.id, body.score, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/referral")
  @HttpCode(200)
  async referral(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.cases.requestReferral(p, params.id, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/archive")
  @HttpCode(200)
  async archive(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.cases.archive(p, params.id, meta);
    return null;
  }

  @RequirePartner("conflict.waive")
  @Post(":id/conflicts/:flagId/waive")
  @HttpCode(200)
  async waive(
    @ZodParams(conflictParams) params: z.infer<typeof conflictParams>,
    @ZodBody(waiveConflictBody) body: z.infer<typeof waiveConflictBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.cases.waiveConflict(p, params.id, params.flagId, body.note, meta);
    return null;
  }
}
