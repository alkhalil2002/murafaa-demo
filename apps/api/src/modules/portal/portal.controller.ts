import { Controller, Get, HttpCode, Inject, Post, Req, Res, StreamableFile } from "@nestjs/common";
import { PORTAL_SESSION_POLICY } from "@murafaa/auth";
import {
  createdCase,
  empPortalProfile,
  empPortalRequestBody,
  empPortalRequests,
  ErrorCode,
  idParams,
  advanceList,
  leaveList,
  portalApprovalParams,
  portalCase,
  portalCaseList,
  portalDecideBody,
  portalInvoiceList,
  portalMe,
  portalMessageBody,
  portalUploadQuery,
  portalVerifyBody,
  requestOtpBody,
  requestOtpResponse,
} from "@murafaa/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { PortalRoute, Public } from "../../common/permissions/permission.decorators.js";
import type { PortalPrincipal } from "../../common/tenancy/principal.js";
import {
  BinaryBody,
  ZodBody,
  ZodParams,
  ZodQuery,
  ZodResponse,
} from "../../common/zod/zod.decorators.js";
import { ENV, type Env } from "../../config/env.js";
import { clearedSessionCookie, sessionCookie } from "../auth/cookies.js";
import { ClientCasesService } from "../cases/client-cases.service.js";
import { DocumentsService } from "../documents/documents.service.js";
import { InvoicePdfService } from "../finance/invoice-pdf.service.js";
import { InvoicesService } from "../finance/invoices.service.js";
import { EmployeesService } from "../hr/employees.service.js";
import { HrRecordsService } from "../hr/records.service.js";
import { PortalAuthService } from "./portal-auth.service.js";
import { PORTAL_COOKIE, type PortalKind } from "./portal-session.service.js";

type Id = z.infer<typeof idParams>;
const meta = (req: FastifyRequest) => ({
  ip: req.ip,
  userAgent: req.headers["user-agent"] ?? null,
  requestId: String(req.id),
});
const who = (req: FastifyRequest): PortalPrincipal => {
  if (!req.portal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return req.portal;
};

/** Sign-in routes shared by both portals; each portal keeps its own cookie. */
abstract class PortalAuthRoutes {
  protected abstract readonly kind: PortalKind;
  constructor(
    protected readonly auth: PortalAuthService,
    protected readonly env: Env,
  ) {}

  protected requestOtpFor(body: z.infer<typeof requestOtpBody>, req: FastifyRequest) {
    return this.auth.requestOtp(this.kind, body.phone, body.channel, meta(req));
  }

  protected async verifyFor(
    body: z.infer<typeof portalVerifyBody>,
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    const { token, principal } = await this.auth.verify(
      this.kind,
      body.phone,
      body.code,
      meta(req),
    );
    void reply.header(
      "set-cookie",
      sessionCookie(
        token,
        PORTAL_SESSION_POLICY.absoluteTtlMs / 1000,
        this.env.NODE_ENV === "production",
        PORTAL_COOKIE[this.kind],
      ),
    );
    return this.auth.me(principal);
  }

  protected async logoutFor(req: FastifyRequest, reply: FastifyReply) {
    if (!req.portalSessionId) throw new ApiException(ErrorCode.UNAUTHENTICATED);
    await this.auth.logout(who(req), req.portalSessionId, meta(req));
    void reply.header(
      "set-cookie",
      clearedSessionCookie(this.env.NODE_ENV === "production", PORTAL_COOKIE[this.kind]),
    );
    return null;
  }
}

/** بوابة العميل (legacy app/portal): the client's own cases, documents, chat, approvals and invoices. */
@Controller("portal")
export class ClientPortalController extends PortalAuthRoutes {
  protected readonly kind = "CLIENT" as const;

  constructor(
    auth: PortalAuthService,
    @Inject(ENV) env: Env,
    private readonly cases: ClientCasesService,
    private readonly docs: DocumentsService,
    private readonly invoices: InvoicesService,
    private readonly invoicePdfs: InvoicePdfService,
  ) {
    super(auth, env);
  }

  @Public()
  @Post("auth/otp")
  @HttpCode(200)
  @ZodResponse(requestOtpResponse)
  requestOtp(
    @ZodBody(requestOtpBody) body: z.infer<typeof requestOtpBody>,
    @Req() req: FastifyRequest,
  ) {
    return this.requestOtpFor(body, req);
  }

  @Public()
  @Post("auth/verify")
  @HttpCode(200)
  @ZodResponse(portalMe)
  verify(
    @ZodBody(portalVerifyBody) body: z.infer<typeof portalVerifyBody>,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.verifyFor(body, req, reply);
  }

  @PortalRoute("CLIENT")
  @Post("auth/logout")
  @HttpCode(200)
  logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.logoutFor(req, reply);
  }

  @PortalRoute("CLIENT")
  @Get("me")
  @ZodResponse(portalMe)
  me(@Req() req: FastifyRequest) {
    return this.auth.me(who(req));
  }

  @PortalRoute("CLIENT")
  @Get("cases")
  @ZodResponse(portalCaseList)
  listCases(@Req() req: FastifyRequest) {
    return this.cases.list(who(req).subjectId);
  }

  @PortalRoute("CLIENT")
  @Get("cases/:id")
  @ZodResponse(portalCase)
  async caseDetail(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const clientId = who(req).subjectId;
    const detail = await this.cases.detail(clientId, params.id);
    return { ...detail, documents: await this.docs.clientDocuments(clientId, params.id) };
  }

  @PortalRoute("CLIENT")
  @Post("cases/:id/messages")
  @ZodResponse(createdCase)
  sendMessage(
    @ZodParams(idParams) params: Id,
    @ZodBody(portalMessageBody) body: z.infer<typeof portalMessageBody>,
    @Req() req: FastifyRequest,
  ) {
    return this.cases.sendMessage(who(req), params.id, body.body, meta(req));
  }

  @PortalRoute("CLIENT")
  @Post("cases/:id/approvals/:approvalId/decide")
  @HttpCode(200)
  async decide(
    @ZodParams(portalApprovalParams) params: z.infer<typeof portalApprovalParams>,
    @ZodBody(portalDecideBody) body: z.infer<typeof portalDecideBody>,
    @Req() req: FastifyRequest,
  ) {
    await this.cases.decide(who(req), params.id, params.approvalId, body, meta(req));
    return null;
  }

  @PortalRoute("CLIENT")
  @Post("cases/:id/documents")
  @ZodResponse(createdCase)
  upload(
    @ZodParams(idParams) params: Id,
    @ZodQuery(portalUploadQuery) query: z.infer<typeof portalUploadQuery>,
    @BinaryBody() bytes: Buffer,
    @Req() req: FastifyRequest,
  ) {
    return this.docs.clientUpload(who(req), params.id, query, bytes, meta(req));
  }

  @PortalRoute("CLIENT")
  @Get("documents/:id/download")
  async download(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const file = await this.docs.clientDownload(who(req), params.id, meta(req));
    return new StreamableFile(file.bytes, {
      type: file.mimeType,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      length: file.bytes.length,
    });
  }

  @PortalRoute("CLIENT")
  @Get("invoices")
  @ZodResponse(portalInvoiceList)
  listInvoices(@Req() req: FastifyRequest) {
    return this.invoices.clientInvoices(who(req).subjectId);
  }

  @PortalRoute("CLIENT")
  @Get("invoices/:id/pdf")
  async invoicePdf(@ZodParams(idParams) params: Id, @Req() req: FastifyRequest) {
    const file = await this.invoicePdfs.clientRender(who(req), params.id, meta(req));
    return new StreamableFile(file.bytes, {
      type: "application/pdf",
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      length: file.bytes.length,
    });
  }
}

/** بوابة الموظف (legacy app/emp-portal): profile, own requests, new requests. */
@Controller("emp-portal")
export class EmployeePortalController extends PortalAuthRoutes {
  protected readonly kind = "EMPLOYEE" as const;

  constructor(
    auth: PortalAuthService,
    @Inject(ENV) env: Env,
    private readonly employees: EmployeesService,
    private readonly records: HrRecordsService,
  ) {
    super(auth, env);
  }

  @Public()
  @Post("auth/otp")
  @HttpCode(200)
  @ZodResponse(requestOtpResponse)
  requestOtp(
    @ZodBody(requestOtpBody) body: z.infer<typeof requestOtpBody>,
    @Req() req: FastifyRequest,
  ) {
    return this.requestOtpFor(body, req);
  }

  @Public()
  @Post("auth/verify")
  @HttpCode(200)
  @ZodResponse(portalMe)
  verify(
    @ZodBody(portalVerifyBody) body: z.infer<typeof portalVerifyBody>,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.verifyFor(body, req, reply);
  }

  @PortalRoute("EMPLOYEE")
  @Post("auth/logout")
  @HttpCode(200)
  logout(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    return this.logoutFor(req, reply);
  }

  @PortalRoute("EMPLOYEE")
  @Get("me")
  @ZodResponse(portalMe)
  me(@Req() req: FastifyRequest) {
    return this.auth.me(who(req));
  }

  @PortalRoute("EMPLOYEE")
  @Get("profile")
  @ZodResponse(empPortalProfile)
  profile(@Req() req: FastifyRequest) {
    return this.employees.selfProfile(who(req).subjectId);
  }

  @PortalRoute("EMPLOYEE")
  @Get("requests")
  @ZodResponse(empPortalRequests)
  requests(@Req() req: FastifyRequest) {
    return this.records.selfRequests(who(req).subjectId);
  }

  @PortalRoute("EMPLOYEE")
  @Get("leaves")
  @ZodResponse(leaveList)
  leaves(@Req() req: FastifyRequest) {
    return this.records.leaves(who(req).subjectId);
  }

  @PortalRoute("EMPLOYEE")
  @Get("advances")
  @ZodResponse(advanceList)
  advances(@Req() req: FastifyRequest) {
    return this.records.advances(who(req).subjectId);
  }

  @PortalRoute("EMPLOYEE")
  @Post("requests")
  @ZodResponse(createdCase)
  submit(
    @ZodBody(empPortalRequestBody) body: z.infer<typeof empPortalRequestBody>,
    @Req() req: FastifyRequest,
  ) {
    return this.records.selfSubmit(who(req), body, meta(req));
  }
}
