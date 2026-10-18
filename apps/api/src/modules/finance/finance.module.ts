import { Module } from "@nestjs/common";
import { PerformanceModule } from "../performance/performance.module.js";
import { BankService } from "./bank.service.js";
import { ExpensesService } from "./expenses.service.js";
import { FeesService } from "./fees.service.js";
import { GovernanceService } from "./governance.service.js";
import { FinanceController } from "./finance.controller.js";
import { InvoicesService } from "./invoices.service.js";
import { LedgerPoster } from "./ledger-poster.service.js";
import { LedgerService } from "./ledger.service.js";
import { ReportsService } from "./reports.service.js";
import { TrustService } from "./trust.service.js";

@Module({
  imports: [PerformanceModule],
  controllers: [FinanceController],
  providers: [
    BankService,
    ExpensesService,
    FeesService,
    GovernanceService,
    InvoicesService,
    LedgerPoster,
    LedgerService,
    ReportsService,
    TrustService,
  ],
  exports: [InvoicesService, LedgerPoster, TrustService],
})
export class FinanceModule {}
