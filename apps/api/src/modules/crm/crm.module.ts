import { Module } from "@nestjs/common";
import { CasesModule } from "../cases/cases.module.js";
import { CrmController } from "./crm.controller.js";
import { CrmService } from "./crm.service.js";

@Module({
  imports: [CasesModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
