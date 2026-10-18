import { Module } from "@nestjs/common";
import { PerformanceService } from "./performance.service.js";

/** The points writer only; reading and ranking live in PulseModule. */
@Module({ providers: [PerformanceService], exports: [PerformanceService] })
export class PerformanceModule {}
