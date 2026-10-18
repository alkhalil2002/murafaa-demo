import "server-only";
import { createApiClient } from "@murafaa/sdk";
import { headers } from "next/headers";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

/**
 * Server-side API client for one request: forwards the caller's cookie (the
 * session) and client IP, so the API authenticates and applies the IP
 * allowlist as if the browser had called it.
 */
export async function serverApi() {
  const h = await headers();
  const client = createApiClient(API_URL);
  client.setConfig({
    headers: {
      cookie: h.get("cookie") ?? "",
      ...(h.get("x-forwarded-for")
        ? { "x-forwarded-for": h.get("x-forwarded-for") as string }
        : {}),
    },
  });
  return client;
}
