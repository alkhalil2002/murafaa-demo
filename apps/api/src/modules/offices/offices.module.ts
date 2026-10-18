import { Module } from "@nestjs/common";
import { OfficesController } from "./offices.controller.js";
import { OfficesService } from "./offices.service.js";

@Module({
  controllers: [OfficesController],
  providers: [OfficesService],
  exports: [OfficesService],
})
export class OfficesModule {}
