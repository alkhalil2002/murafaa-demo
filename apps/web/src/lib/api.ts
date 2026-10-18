import "server-only";
import { createApiClient } from "@murafaa/sdk";

/** Server-side API client. API_URL is the internal Cloud Run URL in production. */
export const api = createApiClient(process.env.API_URL ?? "http://localhost:4000");
