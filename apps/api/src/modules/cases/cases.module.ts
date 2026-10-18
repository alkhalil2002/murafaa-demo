import { Module } from "@nestjs/common";
import { TasksModule } from "../tasks/tasks.module.js";
import { CaseAccess } from "./case-access.service.js";
import { CasesController } from "./cases.controller.js";
import { CasesService } from "./cases.service.js";
import { ConflictsService } from "./conflicts.service.js";
import { DeadlinesService } from "./deadlines.service.js";
import { HearingsController } from "./hearings.controller.js";
import { HearingsService } from "./hearings.service.js";
import { ProcedureRequestsService } from "./procedure-requests.service.js";

@Module({
  imports: [TasksModule],
  controllers: [CasesController, HearingsController],
  providers: [
    CasesService,
    ConflictsService,
    CaseAccess,
    DeadlinesService,
    HearingsService,
    ProcedureRequestsService,
  ],
  exports: [CasesService, ConflictsService, CaseAccess, DeadlinesService],
})
export class CasesModule {}
