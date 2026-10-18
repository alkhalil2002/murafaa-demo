import { Module } from "@nestjs/common";
import { TasksModule } from "../tasks/tasks.module.js";
import { PulseController } from "./pulse.controller.js";
import { PulseService } from "./pulse.service.js";

@Module({
  imports: [TasksModule],
  controllers: [PulseController],
  providers: [PulseService],
  exports: [PulseService],
})
export class PulseModule {}
