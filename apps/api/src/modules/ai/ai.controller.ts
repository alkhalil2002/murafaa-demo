import { Controller, Get, HttpCode, Post, Put, Req } from "@nestjs/common";
import { PermModule } from "@murafaa/auth";
import {
  aiAnswer,
  aiAnswerList,
  aiHistoryQuery,
  aiStatus,
  arenaView,
  askBody,
  createdCase,
  ErrorCode,
  hearingDraft,
  hearingDraftBody,
  idParams,
  kbActiveBody,
  kbSourceBody,
  kbSourceList,
} from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { RequirePermission } from "../../common/permissions/permission.decorators.js";
import { ZodBody, ZodParams, ZodQuery, ZodResponse } from "../../common/zod/zod.decorators.js";
import { AiService } from "./ai.service.js";

type Id = z.infer<typeof idParams>;

function caller(req: FastifyRequest) {
  if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return { p: req.principal, meta: { ip: req.ip, requestId: String(req.id) } };
}

/**
 * المحاكمة الذكية (docs/04 module AI). Every answer passes the citation gate
 * (guardrail 1); the knowledge base is managed at the full level.
 */
@Controller()
export class AiController {
  constructor(private readonly ai: AiService) {}

  @RequirePermission(PermModule.AI, "view")
  @Get("ai/status")
  @ZodResponse(aiStatus)
  status() {
    return this.ai.status();
  }

  @RequirePermission(PermModule.AI, "edit")
  @Post("ai/ask")
  @ZodResponse(aiAnswer)
  ask(@ZodBody(askBody) body: z.infer<typeof askBody>, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    return this.ai.ask(p, body.question, body.caseId, meta);
  }

  @RequirePermission(PermModule.AI, "view")
  @Get("ai/history")
  @ZodResponse(aiAnswerList)
  history(
    @ZodQuery(aiHistoryQuery) query: z.infer<typeof aiHistoryQuery>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.ai.history(p, query.caseId, meta);
  }

  @RequirePermission(PermModule.AI, "view")
  @Get("ai/arena/:id")
  @ZodResponse(arenaView)
  arena(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    return this.ai.arena(p, params.id, meta);
  }

  @RequirePermission(PermModule.AI, "edit")
  @Post("ai/arena/:id/round")
  @HttpCode(200)
  @ZodResponse(arenaView)
  arenaRound(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    return this.ai.arenaRound(p, params.id, meta);
  }

  @RequirePermission(PermModule.AI, "edit")
  @Post("ai/arena/:id/reset")
  @HttpCode(200)
  async arenaReset(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.ai.arenaReset(p, params.id, meta);
    return null;
  }

  @RequirePermission(PermModule.AI, "edit")
  @Post("cases/:id/hearings/draft")
  @HttpCode(200)
  @ZodResponse(hearingDraft)
  hearingDraft(
    @ZodParams(idParams) params: Id,
    @ZodBody(hearingDraftBody) body: z.infer<typeof hearingDraftBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.ai.hearingDraft(p, params.id, body.notes, meta);
  }

  @RequirePermission(PermModule.AI, "view")
  @Get("ai/kb")
  @ZodResponse(kbSourceList)
  kb() {
    return this.ai.kbList();
  }

  @RequirePermission(PermModule.AI, "delete")
  @Post("ai/kb/sources")
  @ZodResponse(createdCase)
  kbAdd(@ZodBody(kbSourceBody) body: z.infer<typeof kbSourceBody>, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    return this.ai.kbAdd(p, body, meta);
  }

  @RequirePermission(PermModule.AI, "delete")
  @Put("ai/kb/sources/:id/active")
  @HttpCode(200)
  async kbActive(
    @ZodParams(idParams) params: Id,
    @ZodBody(kbActiveBody) body: z.infer<typeof kbActiveBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.ai.kbSetActive(p, params.id, body.active, meta);
    return null;
  }
}
