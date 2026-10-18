import { Module } from "@nestjs/common";
import { PerformanceModule } from "../performance/performance.module.js";
import { TasksModule } from "../tasks/tasks.module.js";
import { ApprovalsService } from "./approvals.service.js";
import { CaseAccess } from "./case-access.service.js";
import { CasesController } from "./cases.controller.js";
import { CasesService } from "./cases.service.js";
import { CaseworkController } from "./casework.controller.js";
import { CaseworkService } from "./casework.service.js";
import { ConflictsService } from "./conflicts.service.js";
import { DeadlinesService } from "./deadlines.service.js";
import { ExecutionService } from "./execution.service.js";
import { HearingsController } from "./hearings.controller.js";
import { HearingsService } from "./hearings.service.js";
import { ProcedureRequestsService } from "./procedure-requests.service.js";

@Module({
  imports: [PerformanceModule, TasksModule],
  controllers: [CasesController, CaseworkController, HearingsController],
  providers: [
    CasesService,
    ConflictsService,
    ApprovalsService,
    CaseAccess,
    CaseworkService,
    DeadlinesService,
    ExecutionService,
    HearingsService,
    ProcedureRequestsService,
  ],
  exports: [
    ApprovalsService,
    CasesService,
    CaseworkService,
    ConflictsService,
    CaseAccess,
    DeadlinesService,
  ],
})
export class CasesModule {}
