import { createClient, createConfig } from "./gen/client/index.js";

export * from "./gen/index.js";
export type * from "./gen/types.gen.js";

/**
 * A client bound to one API origin. Web passes it to SDK calls
 * (`healthCheck({ client })`); cookies are sent for session auth.
 */
export function createApiClient(baseUrl: string) {
  return createClient(createConfig({ baseUrl, credentials: "include" }));
}
