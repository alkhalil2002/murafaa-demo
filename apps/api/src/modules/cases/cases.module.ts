import { Module } from "@nestjs/common";
import { CasesController } from "./cases.controller.js";
import { CasesService } from "./cases.service.js";
import { ConflictsService } from "./conflicts.service.js";

@Module({
  controllers: [CasesController],
  providers: [CasesService, ConflictsService],
  exports: [CasesService, ConflictsService],
})
export class CasesModule {}
