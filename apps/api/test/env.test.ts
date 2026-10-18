import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";

const base = { DATABASE_URL: "postgres://u:p@localhost:5432/db" };

describe("loadEnv", () => {
  it("applies safe defaults", () => {
    const env = loadEnv(base);
    expect(env).toMatchObject({ PORT: 4000, RBAC_ENFORCEMENT: "strict", CORS_ORIGINS: [] });
  });

  it("refuses to boot production with permissive RBAC", () => {
    expect(() =>
      loadEnv({ ...base, NODE_ENV: "production", RBAC_ENFORCEMENT: "permissive" }),
    ).toThrow(/RBAC_ENFORCEMENT/);
  });

  it("refuses a missing database URL", () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it("splits CORS origins", () => {
    expect(loadEnv({ ...base, CORS_ORIGINS: "http://a, http://b" }).CORS_ORIGINS).toEqual([
      "http://a",
      "http://b",
    ]);
  });
});
