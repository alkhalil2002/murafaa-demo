import { Controller, Delete, Get, HttpCode, Patch, Post, Put, Req } from "@nestjs/common";
import { PermModule } from "@murafaa/auth";
import {
  approvalParams,
  caseApprovalList,
  caseContractList,
  caseExecutionView,
  caseMessageList,
  clientApprovalBody,
  clientApprovalList,
  clientCommunicationList,
  collectionBody,
  communicationBody,
  communicationParams,
  contractBody,
  contractParams,
  createApprovalBody,
  createdCase,
  ErrorCode,
  executionProcedureBody,
  executionProcedureParams,
  executionStatusBody,
  idParams,
  messageBody,
  openExecutionBody,
  rejectApprovalBody,
  updateExecutionBody,
  updateExecutionProcedureBody,
} from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { RequirePermission } from "../../common/permissions/permission.decorators.js";
import { ZodBody, ZodParams, ZodResponse } from "../../common/zod/zod.decorators.js";
import { ApprovalsService } from "./approvals.service.js";
import { CaseworkService } from "./casework.service.js";
import { ExecutionService } from "./execution.service.js";

function caller(req: FastifyRequest) {
  if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return { p: req.principal, meta: { ip: req.ip, requestId: String(req.id) } };
}

/**
 * Case tabs beyond hearings: approvals, contracts, contact log, chat, client
 * approval requests and execution (module CASES; row scope via CaseAccess).
 * Deleting approvals and execution procedures needs the delete level (legacy).
 */
@Controller("cases")
export class CaseworkController {
  constructor(
    private readonly approvals: ApprovalsService,
    private readonly casework: CaseworkService,
    private readonly execution: ExecutionService,
  ) {}

  @RequirePermission(PermModule.CASES, "view")
  @Get(":id/approvals")
  @ZodResponse(caseApprovalList)
  listApprovals(@ZodParams(idParams) params: z.infer<typeof idParams>, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    return this.approvals.list(p, params.id, meta);
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/approvals")
  @ZodResponse(createdCase)
  createApproval(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(createApprovalBody) body: z.infer<typeof createApprovalBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.approvals.create(p, params.id, body, meta);
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/approvals/:approvalId/advance")
  @HttpCode(200)
  async advanceApproval(
    @ZodParams(approvalParams) params: z.infer<typeof approvalParams>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.approvals.advance(p, params.id, params.approvalId, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/approvals/:approvalId/reject")
  @HttpCode(200)
  async rejectApproval(
    @ZodParams(approvalParams) params: z.infer<typeof approvalParams>,
    @ZodBody(rejectApprovalBody) body: z.infer<typeof rejectApprovalBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.approvals.reject(p, params.id, params.approvalId, body.note, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "delete")
  @Delete(":id/approvals/:approvalId")
  @HttpCode(200)
  async removeApproval(
    @ZodParams(approvalParams) params: z.infer<typeof approvalParams>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.approvals.remove(p, params.id, params.approvalId, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "view")
  @Get(":id/contracts")
  @ZodResponse(caseContractList)
  listContracts(@ZodParams(idParams) params: z.infer<typeof idParams>, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    return this.casework.listContracts(p, params.id, meta);
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/contracts")
  @ZodResponse(createdCase)
  addContract(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(contractBody) body: z.infer<typeof contractBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.casework.addContract(p, params.id, body.title, meta);
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/contracts/:contractId/toggle")
  @HttpCode(200)
  async toggleContract(
    @ZodParams(contractParams) params: z.infer<typeof contractParams>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.casework.toggleContract(p, params.id, params.contractId, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Delete(":id/contracts/:contractId")
  @HttpCode(200)
  async removeContract(
    @ZodParams(contractParams) params: z.infer<typeof contractParams>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.casework.removeContract(p, params.id, params.contractId, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "view")
  @Get(":id/communications")
  @ZodResponse(clientCommunicationList)
  listCommunications(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.casework.listCommunications(p, params.id, meta);
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/communications")
  @ZodResponse(createdCase)
  addCommunication(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(communicationBody) body: z.infer<typeof communicationBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.casework.addCommunication(p, params.id, body, meta);
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Delete(":id/communications/:communicationId")
  @HttpCode(200)
  async removeCommunication(
    @ZodParams(communicationParams) params: z.infer<typeof communicationParams>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.casework.removeCommunication(p, params.id, params.communicationId, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "view")
  @Get(":id/messages")
  @ZodResponse(caseMessageList)
  listMessages(@ZodParams(idParams) params: z.infer<typeof idParams>, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    return this.casework.listMessages(p, params.id, meta);
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/messages")
  @ZodResponse(createdCase)
  sendMessage(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(messageBody) body: z.infer<typeof messageBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.casework.sendMessage(p, params.id, body.body, meta);
  }

  @RequirePermission(PermModule.CASES, "view")
  @Get(":id/client-approvals")
  @ZodResponse(clientApprovalList)
  listClientApprovals(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.casework.listClientApprovals(p, params.id, meta);
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/client-approvals")
  @ZodResponse(createdCase)
  requestClientApproval(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(clientApprovalBody) body: z.infer<typeof clientApprovalBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.casework.requestClientApproval(p, params.id, body, meta);
  }

  @RequirePermission(PermModule.CASES, "view")
  @Get(":id/execution")
  @ZodResponse(caseExecutionView)
  getExecution(@ZodParams(idParams) params: z.infer<typeof idParams>, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    return this.execution.get(p, params.id, meta);
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/execution")
  @ZodResponse(createdCase)
  openExecution(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(openExecutionBody) body: z.infer<typeof openExecutionBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.execution.open(p, params.id, body, meta);
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Patch(":id/execution")
  @HttpCode(200)
  async updateExecution(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(updateExecutionBody) body: z.infer<typeof updateExecutionBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.execution.update(p, params.id, body, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Put(":id/execution/status")
  @HttpCode(200)
  async setExecutionStatus(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(executionStatusBody) body: z.infer<typeof executionStatusBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.execution.setStatus(p, params.id, body.status, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/execution/collections")
  @HttpCode(200)
  async recordCollection(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(collectionBody) body: z.infer<typeof collectionBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.execution.collect(p, params.id, body.amount, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/execution/procedures")
  @ZodResponse(createdCase)
  addExecutionProcedure(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(executionProcedureBody) body: z.infer<typeof executionProcedureBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.execution.addProcedure(p, params.id, body, meta);
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Patch(":id/execution/procedures/:procedureId")
  @HttpCode(200)
  async updateExecutionProcedure(
    @ZodParams(executionProcedureParams) params: z.infer<typeof executionProcedureParams>,
    @ZodBody(updateExecutionProcedureBody) body: z.infer<typeof updateExecutionProcedureBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.execution.updateProcedure(p, params.id, params.procedureId, body, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "edit")
  @Post(":id/execution/procedures/:procedureId/cycle")
  @HttpCode(200)
  async cycleExecutionProcedure(
    @ZodParams(executionProcedureParams) params: z.infer<typeof executionProcedureParams>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.execution.cycleProcedure(p, params.id, params.procedureId, meta);
    return null;
  }

  @RequirePermission(PermModule.CASES, "delete")
  @Delete(":id/execution/procedures/:procedureId")
  @HttpCode(200)
  async removeExecutionProcedure(
    @ZodParams(executionProcedureParams) params: z.infer<typeof executionProcedureParams>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.execution.removeProcedure(p, params.id, params.procedureId, meta);
    return null;
  }
}
