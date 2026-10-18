import { Module } from "@nestjs/common";
import { CasesModule } from "../cases/cases.module.js";
import { CrmModule } from "../crm/crm.module.js";
import { DocumentsModule } from "../documents/documents.module.js";
import { BillingController, BillingService } from "./billing.controller.js";

@Module({
  imports: [CasesModule, CrmModule, DocumentsModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
