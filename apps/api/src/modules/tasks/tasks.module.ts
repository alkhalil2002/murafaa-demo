import { Module } from "@nestjs/common";
import { PerformanceModule } from "../performance/performance.module.js";
import { TasksController } from "./tasks.controller.js";
import { TasksService } from "./tasks.service.js";

@Module({
  imports: [PerformanceModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
