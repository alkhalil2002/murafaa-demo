import { Controller, Delete, Get, HttpCode, Patch, Post, Put, Req } from "@nestjs/common";
import { PermModule } from "@murafaa/auth";
import {
  client,
  clientList,
  convertedLead,
  createClientBody,
  createLeadBody,
  ErrorCode,
  idParams,
  leadList,
  leadsKpis,
  moveLeadBody,
  updateClientBody,
  updateLeadBody,
} from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { RequirePermission } from "../../common/permissions/permission.decorators.js";
import { ZodBody, ZodParams, ZodResponse } from "../../common/zod/zod.decorators.js";
import { CrmService } from "./crm.service.js";

function caller(req: FastifyRequest) {
  if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return { principal: req.principal, meta: { ip: req.ip, requestId: String(req.id) } };
}

/** العملاء: clients and the leads pipeline (docs/04 module CLIENTS). */
@Controller()
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  @RequirePermission(PermModule.CLIENTS, "view")
  @Get("clients")
  @ZodResponse(clientList)
  clients() {
    return this.crm.listClients();
  }

  @RequirePermission(PermModule.CLIENTS, "edit")
  @Post("clients")
  @ZodResponse(client)
  async createClient(
    @ZodBody(createClientBody) body: z.infer<typeof createClientBody>,
    @Req() req: FastifyRequest,
  ) {
    const { principal, meta } = caller(req);
    const c = await this.crm.createClient(principal, body, meta);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      vatNumber: c.vatNumber,
      city: c.city,
      type: c.type,
      status: c.status,
      casesCount: 0,
    };
  }

  @RequirePermission(PermModule.CLIENTS, "edit")
  @Patch("clients/:id")
  @HttpCode(200)
  async updateClient(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(updateClientBody) body: z.infer<typeof updateClientBody>,
    @Req() req: FastifyRequest,
  ) {
    const { principal, meta } = caller(req);
    await this.crm.updateClient(principal, params.id, body, meta);
    return null;
  }

  @RequirePermission(PermModule.CLIENTS, "view")
  @Get("leads")
  @ZodResponse(leadList)
  leads() {
    return this.crm.listLeads();
  }

  @RequirePermission(PermModule.CLIENTS, "view")
  @Get("leads/kpis")
  @ZodResponse(leadsKpis)
  kpis() {
    return this.crm.kpis();
  }

  @RequirePermission(PermModule.CLIENTS, "edit")
  @Post("leads")
  async createLead(
    @ZodBody(createLeadBody) body: z.infer<typeof createLeadBody>,
    @Req() req: FastifyRequest,
  ) {
    const { principal, meta } = caller(req);
    await this.crm.createLead(principal, body, meta);
    return null;
  }

  @RequirePermission(PermModule.CLIENTS, "edit")
  @Put("leads/:id")
  @HttpCode(200)
  async updateLead(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(updateLeadBody) body: z.infer<typeof updateLeadBody>,
    @Req() req: FastifyRequest,
  ) {
    const { principal, meta } = caller(req);
    await this.crm.updateLead(principal, params.id, body, meta);
    return null;
  }

  @RequirePermission(PermModule.CLIENTS, "edit")
  @Post("leads/:id/move")
  @HttpCode(200)
  async moveLead(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(moveLeadBody) body: z.infer<typeof moveLeadBody>,
    @Req() req: FastifyRequest,
  ) {
    const { principal, meta } = caller(req);
    await this.crm.moveLead(principal, params.id, body.direction, meta);
    return null;
  }

  @RequirePermission(PermModule.CLIENTS, "edit")
  @Post("leads/:id/convert")
  @HttpCode(200)
  @ZodResponse(convertedLead)
  convert(@ZodParams(idParams) params: z.infer<typeof idParams>, @Req() req: FastifyRequest) {
    const { principal, meta } = caller(req);
    return this.crm.convertLead(principal, params.id, meta);
  }

  @RequirePermission(PermModule.CLIENTS, "delete")
  @Delete("leads/:id")
  @HttpCode(200)
  async deleteLead(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @Req() req: FastifyRequest,
  ) {
    const { principal, meta } = caller(req);
    await this.crm.deleteLead(principal, params.id, meta);
    return null;
  }
}
