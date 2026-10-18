import { Module } from "@nestjs/common";
import { FinanceModule } from "../finance/finance.module.js";
import { EmployeesService } from "./employees.service.js";
import { HrController } from "./hr.controller.js";
import { PayrollService } from "./payroll.service.js";
import { RecruitmentService } from "./recruitment.service.js";
import { HrRecordsService } from "./records.service.js";

@Module({
  imports: [FinanceModule],
  controllers: [HrController],
  providers: [EmployeesService, HrRecordsService, PayrollService, RecruitmentService],
})
export class HrModule {}
