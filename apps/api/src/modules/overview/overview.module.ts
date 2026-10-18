import { Module } from "@nestjs/common";
import { AppointmentsModule } from "../appointments/appointments.module.js";
import { CasesModule } from "../cases/cases.module.js";
import { CrmModule } from "../crm/crm.module.js";
import { TasksModule } from "../tasks/tasks.module.js";
import { OverviewController } from "./overview.controller.js";
import { OverviewService } from "./overview.service.js";

@Module({
  imports: [AppointmentsModule, CasesModule, CrmModule, TasksModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
