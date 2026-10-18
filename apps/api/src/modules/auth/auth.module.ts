import { Module } from "@nestjs/common";
import { ENV, type Env } from "../../config/env.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { ConsoleOtpProvider, OTP_PROVIDER, UnifonicOtpProvider } from "./otp-provider.js";
import { SessionService } from "./session.service.js";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    {
      provide: OTP_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.OTP_PROVIDER === "unifonic" ? new UnifonicOtpProvider() : new ConsoleOtpProvider(),
    },
  ],
  exports: [SessionService],
})
export class AuthModule {}
