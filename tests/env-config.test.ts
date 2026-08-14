import { describe, expect, it } from "vitest";
import { checkEnv, type EnvLike } from "@/lib/config/env";

/**
 * These guard the failure modes that are silent in production. The storage one
 * matters most: without it, a misconfigured deploy destroys uploaded case
 * documents on every restart and reports nothing.
 */
const base: EnvLike = {
  DATABASE_URL: "postgresql://u@h:5432/db",
  AUTH_SECRET: "S6Zr0m0nQpYkq2m0f9Xw1cVb3Nd8Jt5LhGyPzAeRuKM=",
};

const fatalKeys = (env: EnvLike) =>
  checkEnv(env).filter((i) => i.level === "fatal").map((i) => i.key);

describe("checkEnv — development", () => {
  it("accepts local storage and the console OTP provider", () => {
    expect(checkEnv({ ...base, NODE_ENV: "development" })).toEqual([]);
  });
});

describe("checkEnv — production", () => {
  const prod: EnvLike = { ...base, NODE_ENV: "production" };

  it("REFUSES local storage — Cloud Run would destroy uploaded documents", () => {
    expect(fatalKeys(prod)).toContain("STORAGE_DRIVER");
  });

  it("accepts gcs with a bucket", () => {
    expect(fatalKeys({ ...prod, STORAGE_DRIVER: "gcs", GCS_BUCKET: "murafaa-docs" })).toEqual([]);
  });

  it("refuses gcs without a bucket", () => {
    expect(fatalKeys({ ...prod, STORAGE_DRIVER: "gcs" })).toContain("GCS_BUCKET");
  });

  it("refuses the development placeholder secret", () => {
    expect(
      fatalKeys({ ...prod, STORAGE_DRIVER: "gcs", GCS_BUCKET: "b", AUTH_SECRET: "change-me-in-local" }),
    ).toContain("AUTH_SECRET");
  });

  it("refuses a short secret", () => {
    expect(fatalKeys({ ...prod, STORAGE_DRIVER: "gcs", GCS_BUCKET: "b", AUTH_SECRET: "tooshort" })).toContain(
      "AUTH_SECRET",
    );
  });

  it("refuses a missing database url", () => {
    const noDb: EnvLike = { ...prod, STORAGE_DRIVER: "gcs", GCS_BUCKET: "b", DATABASE_URL: undefined };
    expect(fatalKeys(noDb)).toContain("DATABASE_URL");
  });

  it("warns but does not block on the console OTP provider — staging needs it", () => {
    const issues = checkEnv({ ...prod, STORAGE_DRIVER: "gcs", GCS_BUCKET: "b" });
    expect(issues.filter((i) => i.level === "fatal")).toEqual([]);
    expect(issues.find((i) => i.key === "OTP_PROVIDER")?.level).toBe("warn");
  });
});
