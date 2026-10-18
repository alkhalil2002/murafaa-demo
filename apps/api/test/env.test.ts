import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/config/env.js";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  AUTH_SECRET: "x".repeat(32),
  ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
};

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

  it("refuses missing or weak auth secrets", () => {
    expect(() => loadEnv({ ...base, AUTH_SECRET: "" })).toThrow(/AUTH_SECRET/);
    expect(() => loadEnv({ ...base, ENCRYPTION_KEY: "c2hvcnQ=" })).toThrow(/ENCRYPTION_KEY/);
  });

  it("refuses the console OTP provider in production", () => {
    expect(() => loadEnv({ ...base, NODE_ENV: "production", OTP_PROVIDER: "console" })).toThrow(
      /OTP_PROVIDER/,
    );
    const prodStorage = { STORAGE_DRIVER: "gcs", GCS_BUCKET: "murafaa-docs" };
    expect(
      loadEnv({ ...base, ...prodStorage, NODE_ENV: "production", OTP_PROVIDER: "unifonic" })
        .OTP_PROVIDER,
    ).toBe("unifonic");
  });

  it("keeps production documents in GCS and needs a bucket for it", () => {
    const prod = { ...base, NODE_ENV: "production", OTP_PROVIDER: "unifonic" };
    expect(() => loadEnv({ ...prod, STORAGE_DRIVER: "local" })).toThrow(/STORAGE_DRIVER/);
    expect(() => loadEnv({ ...base, STORAGE_DRIVER: "gcs" })).toThrow(/GCS_BUCKET/);
    expect(loadEnv(base).STORAGE_DRIVER).toBe("local");
  });

  it("splits CORS origins", () => {
    expect(loadEnv({ ...base, CORS_ORIGINS: "http://a, http://b" }).CORS_ORIGINS).toEqual([
      "http://a",
      "http://b",
    ]);
  });
});
