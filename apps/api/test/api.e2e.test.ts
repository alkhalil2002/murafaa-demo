import { runMigrations } from "@murafaa/database";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, mountDocs } from "../src/app.factory.js";
import type { Principal } from "../src/common/tenancy/principal.js";
import { loadEnv } from "../src/config/env.js";

/**
 * Full HTTP pipeline against a real Postgres: guard → tenant context →
 * TenantDb → RLS. Auth (OTP sessions) is not built yet, so a test-only hook
 * sets the principal from a header; the production app has no such hook.
 */

const OWNER_URL =
  process.env.TEST_MIGRATION_DATABASE_URL ??
  "postgres://murafaa:murafaa@localhost:5440/murafaa_test";
const APP_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://murafaa_api:murafaa_api@localhost:5440/murafaa_test";

const OFFICE_A = "aaaaaaaa-0000-4000-8000-00000000000a";
const OFFICE_B = "bbbbbbbb-0000-4000-8000-00000000000b";
const NO_OFFICE = "cccccccc-0000-4000-8000-00000000000c";

let app: NestFastifyApplication;

const as = (officeId: string): Record<string, string> => ({ "x-test-office": officeId });

beforeAll(async () => {
  await runMigrations(OWNER_URL);
  const owner = postgres(OWNER_URL, { max: 1 });
  await owner`truncate audit_log, outbox, users, offices cascade`;
  for (const [id, name] of [
    [OFFICE_A, "Office A"],
    [OFFICE_B, "Office B"],
  ] as const) {
    await owner.begin(async (tx) => {
      await tx`select set_config('app.office_id', ${id}, true)`;
      await tx`insert into offices (id, name) values (${id}, ${name})`;
    });
  }
  await owner.end();

  const env = loadEnv({
    DATABASE_URL: APP_URL,
    NODE_ENV: "test",
    LOG_LEVEL: "fatal",
    RBAC_ENFORCEMENT: "strict",
  });
  app = await createApp(env);
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("onRequest", async (request) => {
      const officeId = request.headers["x-test-office"];
      if (typeof officeId === "string") {
        request.principal = { userId: officeId, officeId, role: "LAWYER" } satisfies Principal;
      }
    });
  mountDocs(app, env);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
});

afterAll(async () => {
  await app?.close();
});

describe("API", () => {
  it("reports health inside the envelope", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { status: "ok", db: "up", version: "0.0.0" }, error: null });
  });

  it("rejects a missing session with an error envelope", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/offices/current" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      data: null,
      error: { code: "UNAUTHENTICATED", messageKey: "errors.UNAUTHENTICATED" },
    });
    expect(res.json().error.requestId).toBeTruthy();
  });

  it("returns only the caller's office", async () => {
    const a = await app.inject({
      method: "GET",
      url: "/api/v1/offices/current",
      headers: as(OFFICE_A),
    });
    const b = await app.inject({
      method: "GET",
      url: "/api/v1/offices/current",
      headers: as(OFFICE_B),
    });
    expect(a.json().data).toMatchObject({ id: OFFICE_A, name: "Office A" });
    expect(b.json().data).toMatchObject({ id: OFFICE_B, name: "Office B" });
  });

  it("finds nothing for an office the database does not let it see", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/offices/current",
      headers: as(NO_OFFICE),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("renders unknown routes as an error envelope", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ data: null, error: { code: "NOT_FOUND" } });
  });

  it("serves the zod-derived OpenAPI document", async () => {
    const res = await app.inject({ method: "GET", url: "/api/docs-json" });
    expect(res.statusCode).toBe(200);
    const doc = res.json();
    expect(doc.paths).toHaveProperty(["/api/v1/health"]);
    expect(doc.paths).toHaveProperty(["/api/v1/offices/current"]);
    expect(doc.components.schemas).toHaveProperty("Office");
  });
});
