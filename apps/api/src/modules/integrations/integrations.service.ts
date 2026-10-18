import { Inject, Injectable } from "@nestjs/common";
import { INTEGRATIONS } from "@murafaa/rules";
import type { Principal } from "../../common/tenancy/principal.js";
import { OfficesService } from "../offices/offices.service.js";
import { INTEGRATION_ADAPTERS, type IntegrationAdapter } from "./integration.js";

@Injectable()
export class IntegrationsService {
  constructor(
    @Inject(INTEGRATION_ADAPTERS) private readonly adapters: IntegrationAdapter[],
    private readonly offices: OfficesService,
  ) {}

  async list(p: Principal) {
    const tax = await this.offices.taxProfile();
    return Promise.all(
      INTEGRATIONS.map(async ({ key, group }) => {
        const adapter = this.adapters.find((a) => a.key === key);
        const status = adapter ? await adapter.status(p.officeId) : "NOT_CONNECTED";
        return key === "ZATCA"
          ? { key, group, status, phase1Ready: Boolean(tax.vatNumber) }
          : { key, group, status };
      }),
    );
  }
}
