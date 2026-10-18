import { Controller, Delete, HttpCode, Patch, Post, Put, Req } from "@nestjs/common";
import { PermModule } from "@murafaa/auth";
import {
  createdCase,
  decideReportBody,
  ErrorCode,
  escalateReminderBody,
  hearingItemParams,
  hearingParams,
  hearingTaskBody,
  idParams,
  nextHearingBody,
  procedureRequestBody,
  procedureRequestParams,
  recordHearingBody,
  reminderBody,
  updateHearingBody,
  updateHearingTaskBody,
  updateReminderBody,
} from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { RequirePermission } from "../../common/permissions/permission.decorators.js";
import { ZodBody, ZodParams, ZodResponse } from "../../common/zod/zod.decorators.js";
import { HearingsService } from "./hearings.service.js";
import { ProcedureRequestsService } from "./procedure-requests.service.js";

type HearingP = z.infer<typeof hearingParams>;
type ItemP = z.infer<typeof hearingItemParams>;

function caller(req: FastifyRequest) {
  if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return { p: req.principal, meta: { ip: req.ip, requestId: String(req.id) } };
}

/** Hearings, their follow-up actions and procedural requests on a case (module CASES, row scope via CaseAccess). */
@Controller("cases")
export class HearingsController {
  constructor(
    private readonly hearings: HearingsService,
    private readonly requests: ProcedureRequestsService,
  ) {}

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/hearings")
  @ZodResponse(createdCase)
  record(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(recordHearingBody) body: z.infer<typeof recordHearingBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.hearings.record(p, params.id, body, meta);
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Put(":id/hearings/next")
  @HttpCode(200)
  async setNext(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(nextHearingBody) body: z.infer<typeof nextHearingBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.hearings.setNext(p, params.id, body.date, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Patch(":id/hearings/:hearingId")
  @HttpCode(200)
  async update(
    @ZodParams(hearingParams) params: HearingP,
    @ZodBody(updateHearingBody) body: z.infer<typeof updateHearingBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.hearings.update(p, params.id, params.hearingId, body, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "delete")
  @Delete(":id/hearings/:hearingId")
  @HttpCode(200)
  async remove(@ZodParams(hearingParams) params: HearingP, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.hearings.remove(p, params.id, params.hearingId, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/hearings/:hearingId/reminders")
  @HttpCode(200)
  async addReminder(
    @ZodParams(hearingParams) params: HearingP,
    @ZodBody(reminderBody) body: z.infer<typeof reminderBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.hearings.addReminder(p, params.id, params.hearingId, body, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Patch(":id/hearings/:hearingId/reminders/:itemId")
  @HttpCode(200)
  async updateReminder(
    @ZodParams(hearingItemParams) params: ItemP,
    @ZodBody(updateReminderBody) body: z.infer<typeof updateReminderBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.hearings.updateReminder(p, params.id, params.hearingId, params.itemId, body, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Delete(":id/hearings/:hearingId/reminders/:itemId")
  @HttpCode(200)
  async removeReminder(@ZodParams(hearingItemParams) params: ItemP, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.hearings.removeReminder(p, params.id, params.hearingId, params.itemId, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/hearings/:hearingId/reminders/:itemId/escalate")
  @HttpCode(200)
  async escalate(
    @ZodParams(hearingItemParams) params: ItemP,
    @ZodBody(escalateReminderBody) body: z.infer<typeof escalateReminderBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.hearings.escalateReminder(
      p,
      params.id,
      params.hearingId,
      params.itemId,
      body.assigneeId ?? null,
      meta,
    );
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/hearings/:hearingId/tasks")
  @HttpCode(200)
  async addTask(
    @ZodParams(hearingParams) params: HearingP,
    @ZodBody(hearingTaskBody) body: z.infer<typeof hearingTaskBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.hearings.addTask(p, params.id, params.hearingId, body, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Patch(":id/hearings/:hearingId/tasks/:itemId")
  @HttpCode(200)
  async updateTask(
    @ZodParams(hearingItemParams) params: ItemP,
    @ZodBody(updateHearingTaskBody) body: z.infer<typeof updateHearingTaskBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.hearings.updateTask(p, params.id, params.hearingId, params.itemId, body, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Delete(":id/hearings/:hearingId/tasks/:itemId")
  @HttpCode(200)
  async removeTask(@ZodParams(hearingItemParams) params: ItemP, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.hearings.removeTask(p, params.id, params.hearingId, params.itemId, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/hearings/:hearingId/report/request")
  @HttpCode(200)
  async requestReport(@ZodParams(hearingParams) params: HearingP, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.hearings.requestReportApproval(p, params.id, params.hearingId, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/hearings/:hearingId/report/cancel")
  @HttpCode(200)
  async cancelReport(@ZodParams(hearingParams) params: HearingP, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.hearings.cancelReportApproval(p, params.id, params.hearingId, meta);
    return null;
  }

  /** Approving a client report is a supervisor act: legacy gates it on the case delete level. */
  @RequirePermission(PermModule.CASES, "delete")
  @Post(":id/hearings/:hearingId/report/decide")
  @HttpCode(200)
  async decideReport(
    @ZodParams(hearingParams) params: HearingP,
    @ZodBody(decideReportBody) body: z.infer<typeof decideReportBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.hearings.decideReport(p, params.id, params.hearingId, body.approve, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/procedure-requests")
  @HttpCode(200)
  async addRequest(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(procedureRequestBody) body: z.infer<typeof procedureRequestBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.requests.add(p, params.id, body, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/procedure-requests/:requestId/cycle")
  @HttpCode(200)
  async cycleRequest(
    @ZodParams(procedureRequestParams) params: z.infer<typeof procedureRequestParams>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.requests.cycleStatus(p, params.id, params.requestId, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "delete")
  @Delete(":id/procedure-requests/:requestId")
  @HttpCode(200)
  async removeRequest(
    @ZodParams(procedureRequestParams) params: z.infer<typeof procedureRequestParams>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.requests.remove(p, params.id, params.requestId, meta);
    return null;
  }
}
