import { type DynamicModule, Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, DiscoveryModule } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter.js";
import { EnvelopeInterceptor } from "./common/http/envelope.interceptor.js";
import { PermissionsGuard } from "./common/permissions/permissions.guard.js";
import { PolicyService } from "./common/permissions/policy.service.js";
import { TenantInterceptor } from "./common/tenancy/tenant.interceptor.js";
import { ENV, type Env } from "./config/env.js";
import { LLM, type LlmProvider, llmFor } from "./modules/ai/llm.js";
import { DatabaseModule } from "./database/database.module.js";
import { AiModule } from "./modules/ai/ai.module.js";
import { HrModule } from "./modules/hr/hr.module.js";
import { PlatformModule } from "./modules/platform/platform.module.js";
import { PortalModule } from "./modules/portal/portal.module.js";
import { WhatsappModule } from "./modules/whatsapp/whatsapp.module.js";
import { IntegrationsModule } from "./modules/integrations/integrations.module.js";
import { PulseModule } from "./modules/pulse/pulse.module.js";
import { AppointmentsModule } from "./modules/appointments/appointments.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { BillingModule } from "./modules/billing/billing.module.js";
import { CasesModule } from "./modules/cases/cases.module.js";
import { CrmModule } from "./modules/crm/crm.module.js";
import { DocumentsModule } from "./modules/documents/documents.module.js";
import { FinanceModule } from "./modules/finance/finance.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { OfficesModule } from "./modules/offices/offices.module.js";
import { OverviewModule } from "./modules/overview/overview.module.js";
import { PermissionsModule } from "./modules/permissions/permissions.module.js";
import { RecycleModule } from "./modules/recycle/recycle.module.js";
import { SecurityModule } from "./modules/security/security.module.js";
import { TasksModule } from "./modules/tasks/tasks.module.js";

/** Log fields that may hold credentials or personal data (PDPL: minimize PII in logs). */
const REDACT = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
  "*.phone",
  "*.otp",
  "*.password",
  "*.token",
];

@Module({})
export class AppModule {
  /** `overrides.llm` lets the e2e tests answer for the model; production always uses llmFor(env). */
  static forRoot(env: Env, overrides: { llm?: LlmProvider } = {}): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: env.LOG_LEVEL,
            redact: { paths: REDACT, censor: "[redacted]" },
            transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
          },
        }),
        DiscoveryModule,
        DatabaseModule,
        AiModule,
        AppointmentsModule,
        AuthModule,
        BillingModule,
        CasesModule,
        CrmModule,
        DocumentsModule,
        FinanceModule,
        HealthModule,
        OfficesModule,
        HrModule,
        IntegrationsModule,
        OverviewModule,
        PlatformModule,
        PortalModule,
        PulseModule,
        PermissionsModule,
        RecycleModule,
        SecurityModule,
        TasksModule,
        WhatsappModule,
      ],
      providers: [
        { provide: ENV, useValue: env },
        { provide: LLM, useValue: overrides.llm ?? llmFor(env) },
        PolicyService,
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
        { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
      exports: [ENV, LLM, PolicyService],
    };
  }
}
