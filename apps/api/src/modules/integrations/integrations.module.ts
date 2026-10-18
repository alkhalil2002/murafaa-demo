import { Module } from "@nestjs/common";
import { INTEGRATIONS } from "@murafaa/rules";
import { OfficesModule } from "../offices/offices.module.js";
import { INTEGRATION_ADAPTERS, NotConnected } from "./integration.js";
import { IntegrationsController } from "./integrations.controller.js";
import { IntegrationsService } from "./integrations.service.js";

/** No platform has a signed API contract yet, so every adapter is NotConnected. */
@Module({
  imports: [OfficesModule],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    { provide: INTEGRATION_ADAPTERS, useValue: INTEGRATIONS.map((i) => new NotConnected(i.key)) },
  ],
})
export class IntegrationsModule {}
