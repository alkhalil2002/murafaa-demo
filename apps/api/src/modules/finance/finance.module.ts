import { Module } from "@nestjs/common";
import { FeesService } from "./fees.service.js";
import { FinanceController } from "./finance.controller.js";
import { InvoicesService } from "./invoices.service.js";
import { LedgerService } from "./ledger.service.js";
import { TrustService } from "./trust.service.js";

@Module({
  controllers: [FinanceController],
  providers: [FeesService, InvoicesService, LedgerService, TrustService],
  exports: [InvoicesService, TrustService],
})
export class FinanceModule {}
