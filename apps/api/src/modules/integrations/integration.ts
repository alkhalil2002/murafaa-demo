import type { IntegrationKey, IntegrationStatus } from "@murafaa/rules";

/**
 * One government platform behind a single interface (docs/02 §7: adapters,
 * credentials in Secret Manager, retries). A real adapter is added only with
 * the platform's signed API contract and a test environment; it reports
 * CONNECTED once its credentials check out. Until then the platform has the
 * NotConnected adapter, which never returns data.
 */
export interface IntegrationAdapter {
  readonly key: IntegrationKey;
  status(officeId: string): Promise<IntegrationStatus>;
}

export class NotConnected implements IntegrationAdapter {
  constructor(readonly key: IntegrationKey) {}
  status(): Promise<IntegrationStatus> {
    return Promise.resolve("NOT_CONNECTED");
  }
}

export const INTEGRATION_ADAPTERS = Symbol("INTEGRATION_ADAPTERS");
