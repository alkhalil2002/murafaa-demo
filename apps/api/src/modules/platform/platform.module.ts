import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PlatformActivationService } from "./platform-activation.service.js";
import { PlatformAuthService } from "./platform-auth.service.js";
import { PlatformController } from "./platform.controller.js";
import { PlatformOfficesService } from "./platform-offices.service.js";
import { PlatformSessionService } from "./platform-session.service.js";
import { PlatformTeamService } from "./platform-team.service.js";

/** إدارة المنصة: platform sign-in and office management (no tenant scope). */
@Module({
  imports: [AuthModule],
  controllers: [PlatformController],
  providers: [
    PlatformActivationService,
    PlatformAuthService,
    PlatformOfficesService,
    PlatformSessionService,
    PlatformTeamService,
  ],
  exports: [PlatformSessionService],
})
export class PlatformModule {}
