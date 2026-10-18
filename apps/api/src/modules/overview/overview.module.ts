import { Module } from "@nestjs/common";
import { AppointmentsModule } from "../appointments/appointments.module.js";
import { CasesModule } from "../cases/cases.module.js";
import { CrmModule } from "../crm/crm.module.js";
import { DocumentsModule } from "../documents/documents.module.js";
import { FinanceModule } from "../finance/finance.module.js";
import { TasksModule } from "../tasks/tasks.module.js";
import { OverviewController } from "./overview.controller.js";
import { OverviewService } from "./overview.service.js";

@Module({
  imports: [
    AppointmentsModule,
    CasesModule,
    CrmModule,
    DocumentsModule,
    FinanceModule,
    TasksModule,
  ],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
