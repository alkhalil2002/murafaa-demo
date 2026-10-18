import { AsyncLocalStorage } from "node:async_hooks";

/** The office the current request runs in (a staff or portal principal), for TenantDb. */
export const tenantContext = new AsyncLocalStorage<{ officeId: string }>();
