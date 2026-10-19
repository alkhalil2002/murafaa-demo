import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { PlatformAuthService } from "./platform-auth.service.js";
import { PlatformController } from "./platform.controller.js";
import { PlatformOfficesService } from "./platform-offices.service.js";
import { PlatformSessionService } from "./platform-session.service.js";

/** إدارة المنصة: platform sign-in and office management (no tenant scope). */
@Module({
  imports: [AuthModule],
  controllers: [PlatformController],
  providers: [PlatformAuthService, PlatformOfficesService, PlatformSessionService],
  exports: [PlatformSessionService],
})
export class PlatformModule {}
