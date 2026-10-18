import { createApiClient } from "@murafaa/sdk";

/**
 * Browser-side API client. Requests go to this site's own /api path, which
 * Next rewrites to the API, so the session cookie stays first-party.
 */
export const browserApi = createApiClient("");
