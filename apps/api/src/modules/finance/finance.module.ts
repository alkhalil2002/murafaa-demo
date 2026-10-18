import { Module } from "@nestjs/common";
import { BankService } from "./bank.service.js";
import { ExpensesService } from "./expenses.service.js";
import { FeesService } from "./fees.service.js";
import { GovernanceService } from "./governance.service.js";
import { FinanceController } from "./finance.controller.js";
import { InvoicesService } from "./invoices.service.js";
import { LedgerService } from "./ledger.service.js";
import { ReportsService } from "./reports.service.js";
import { TrustService } from "./trust.service.js";

@Module({
  controllers: [FinanceController],
  providers: [
    BankService,
    ExpensesService,
    FeesService,
    GovernanceService,
    InvoicesService,
    LedgerService,
    ReportsService,
    TrustService,
  ],
  exports: [InvoicesService, TrustService],
})
export class FinanceModule {}
