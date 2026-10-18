import { Controller, Get, HttpCode, Post, Put, Req } from "@nestjs/common";
import { PermModule } from "@murafaa/auth";
import {
  accountList,
  billingParties,
  clientParams,
  createdCase,
  createdNumber,
  createInvoiceBody,
  creditNoteBody,
  ErrorCode,
  feeAgreementBody,
  feeAgreementView,
  idParams,
  invoiceDetail,
  invoiceList,
  invoiceListQuery,
  journalList,
  paymentBody,
  periodList,
  periodLockBody,
  periodParams,
  timeEntryBody,
  timeEntryList,
  timeEntryQuery,
  trustAccountList,
  trustBalance,
  trustLedger,
  trustMoveBody,
} from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";
import { ApiException } from "../../common/http/api.exception.js";
import { RequirePermission } from "../../common/permissions/permission.decorators.js";
import { ZodBody, ZodParams, ZodQuery, ZodResponse } from "../../common/zod/zod.decorators.js";
import { FeesService } from "./fees.service.js";
import { InvoicesService } from "./invoices.service.js";
import { LedgerService } from "./ledger.service.js";
import { TrustService } from "./trust.service.js";

function caller(req: FastifyRequest) {
  if (!req.principal) throw new ApiException(ErrorCode.UNAUTHENTICATED);
  return { p: req.principal, meta: { ip: req.ip, requestId: String(req.id) } };
}

/**
 * المالية (docs/04 module FINANCE): invoices, fees and time, trust, ledger.
 * Credit notes, write-offs and period locks need the full level.
 */
@Controller()
export class FinanceController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly fees: FeesService,
    private readonly trust: TrustService,
    private readonly ledger: LedgerService,
  ) {}

  @RequirePermission(PermModule.FINANCE, "view")
  @Get("finance/parties")
  @ZodResponse(billingParties)
  parties(@Req() req: FastifyRequest) {
    return this.invoices.parties(caller(req).p);
  }

  @RequirePermission(PermModule.FINANCE, "view")
  @Get("finance/invoices")
  @ZodResponse(invoiceList)
  listInvoices(@ZodQuery(invoiceListQuery) query: z.infer<typeof invoiceListQuery>) {
    return this.invoices.list(query);
  }

  @RequirePermission(PermModule.FINANCE, "edit")
  @Post("finance/invoices")
  @ZodResponse(createdNumber)
  createInvoice(
    @ZodBody(createInvoiceBody) body: z.infer<typeof createInvoiceBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.invoices.create(p, body, meta);
  }

  @RequirePermission(PermModule.FINANCE, "view")
  @Get("finance/invoices/:id")
  @ZodResponse(invoiceDetail)
  invoiceDetail(@ZodParams(idParams) params: z.infer<typeof idParams>) {
    return this.invoices.detail(params.id);
  }

  @RequirePermission(PermModule.FINANCE, "edit")
  @Post("finance/invoices/:id/payments")
  @ZodResponse(createdNumber)
  recordPayment(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(paymentBody) body: z.infer<typeof paymentBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.invoices.pay(p, params.id, body, meta);
  }

  @RequirePermission(PermModule.FINANCE, "delete")
  @Post("finance/invoices/:id/credit-note")
  @ZodResponse(createdNumber)
  creditNote(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(creditNoteBody) body: z.infer<typeof creditNoteBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.invoices.creditNote(p, params.id, body.reason, meta);
  }

  @RequirePermission(PermModule.FINANCE, "delete")
  @Post("finance/invoices/:id/bad-debt")
  @HttpCode(200)
  async writeOff(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.invoices.badDebt(p, params.id, meta);
    return null;
  }

  @RequirePermission(PermModule.FINANCE, "view")
  @Get("cases/:id/fee-agreement")
  @ZodResponse(feeAgreementView)
  feeAgreement(@ZodParams(idParams) params: z.infer<typeof idParams>) {
    return this.fees.view(params.id);
  }

  @RequirePermission(PermModule.FINANCE, "edit")
  @Put("cases/:id/fee-agreement")
  @HttpCode(200)
  async saveFeeAgreement(
    @ZodParams(idParams) params: z.infer<typeof idParams>,
    @ZodBody(feeAgreementBody) body: z.infer<typeof feeAgreementBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.fees.save(p, params.id, body, meta);
    return null;
  }

  @RequirePermission(PermModule.FINANCE, "edit")
  @Post("cases/:id/fee-agreement/invoice")
  @ZodResponse(createdNumber)
  invoiceFee(@ZodParams(idParams) params: z.infer<typeof idParams>, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    return this.fees.invoiceFee(p, params.id, meta);
  }

  @RequirePermission(PermModule.FINANCE, "view")
  @Get("finance/time-entries")
  @ZodResponse(timeEntryList)
  listTime(@ZodQuery(timeEntryQuery) query: z.infer<typeof timeEntryQuery>) {
    return this.fees.listTime(query.caseId);
  }

  @RequirePermission(PermModule.FINANCE, "edit")
  @Post("finance/time-entries")
  @ZodResponse(createdCase)
  addTime(@ZodBody(timeEntryBody) body: z.infer<typeof timeEntryBody>, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    return this.fees.addTime(p, body, meta);
  }

  @RequirePermission(PermModule.FINANCE, "edit")
  @Post("finance/time-entries/:id/invoice")
  @ZodResponse(createdNumber)
  invoiceTime(@ZodParams(idParams) params: z.infer<typeof idParams>, @Req() req: FastifyRequest) {
    const { p, meta } = caller(req);
    return this.fees.invoiceTime(p, params.id, meta);
  }

  @RequirePermission(PermModule.FINANCE, "view")
  @Get("finance/trust")
  @ZodResponse(trustAccountList)
  trustAccounts() {
    return this.trust.list();
  }

  @RequirePermission(PermModule.FINANCE, "view")
  @Get("finance/trust/:clientId")
  @ZodResponse(trustLedger)
  trustLedger(@ZodParams(clientParams) params: z.infer<typeof clientParams>) {
    return this.trust.ledger(params.clientId);
  }

  @RequirePermission(PermModule.FINANCE, "edit")
  @Post("finance/trust/:clientId/movements")
  @ZodResponse(trustBalance)
  trustMove(
    @ZodParams(clientParams) params: z.infer<typeof clientParams>,
    @ZodBody(trustMoveBody) body: z.infer<typeof trustMoveBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    return this.trust.record(p, params.clientId, body, meta);
  }

  @RequirePermission(PermModule.FINANCE, "view")
  @Get("finance/accounts")
  @ZodResponse(accountList)
  accounts() {
    return this.ledger.accounts();
  }

  @RequirePermission(PermModule.FINANCE, "view")
  @Get("finance/journal")
  @ZodResponse(journalList)
  journal() {
    return this.ledger.journal();
  }

  @RequirePermission(PermModule.FINANCE, "view")
  @Get("finance/periods")
  @ZodResponse(periodList)
  periods() {
    return this.ledger.periods();
  }

  @RequirePermission(PermModule.FINANCE, "delete")
  @Put("finance/periods/:periodKey")
  @HttpCode(200)
  async setPeriodLock(
    @ZodParams(periodParams) params: z.infer<typeof periodParams>,
    @ZodBody(periodLockBody) body: z.infer<typeof periodLockBody>,
    @Req() req: FastifyRequest,
  ) {
    const { p, meta } = caller(req);
    await this.ledger.setLock(p, params.periodKey, body.locked, meta);
    return null;
  }
}
