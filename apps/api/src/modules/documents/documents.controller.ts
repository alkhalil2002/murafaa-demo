import { Controller, Delete, Get, HttpCode, Post, Req, StreamableFile } from "@nestjs/common";
import { PermModule } from "@murafaa/auth";
import {
  clearedCount,
  documentItem,
  documentList,
  ErrorCode,
  idParams,
  uploadDocumentQuery,
} from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { RequirePermission } from "../../common/permissions/permission.decorators.js";
import { BinaryBody, ZodParams, ZodQuery, ZodResponse } from "../../common/zod/zod.decorators.js";
import { DocumentsService } from "./documents.service.js";

type Id = z.infer<typeof idParams>;

function caller(req: FastifyRequest) {
  if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return { p: req.principal, meta: { ip: req.ip, requestId: String(req.id) } };
}

/** المستندات (docs/04 module DOCUMENTS); the case row scope applies inside the service. */
@Controller()
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @RequirePermission(PermModule.DOCUMENTS, "view")
  @Get("cases/:id/documents")
  @ZodResponse(documentList)
  list(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    return this.docs.list(p, params.id, meta);
  }

  /** Body: the file's bytes (application/octet-stream). Query: its metadata. */
  @RequirePermission(PermModule.DOCUMENTS, "edit")
  @Post("cases/:id/documents")
  @ZodResponse(documentItem)
  upload(
    @ZodParams(idParams) params: Id,
    @ZodQuery(uploadDocumentQuery) query: z.infer<typeof uploadDocumentQuery>,
    @BinaryBody() bytes: Buffer,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.docs.upload(p, params.id, query, bytes, meta);
  }

  @RequirePermission(PermModule.DOCUMENTS, "delete")
  @Post("cases/:id/documents/clear-opening")
  @ZodResponse(clearedCount)
  clearOpening(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    return this.docs.clearOpening(p, params.id, meta);
  }

  /** Streams the bytes (no public bucket URL); RFC 5987 file name for Arabic. */
  @RequirePermission(PermModule.DOCUMENTS, "view")
  @Get("documents/:id/download")
  async download(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    const file = await this.docs.download(p, params.id, meta);
    return new StreamableFile(file.bytes, {
      type: file.mimeType,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      length: file.bytes.length,
    });
  }

  @RequirePermission(PermModule.DOCUMENTS, "edit")
  @Post("documents/:id/share")
  @HttpCode(200)
  async share(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.docs.toggleShare(p, params.id, meta);
    return null;
  }

  @RequirePermission(PermModule.DOCUMENTS, "delete")
  @Delete("documents/:id")
  @HttpCode(200)
  async remove(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    await this.docs.remove(p, params.id, meta);
    return null;
  }
}
