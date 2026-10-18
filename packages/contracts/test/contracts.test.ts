import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createOfficeBody,
  errorEnvelope,
  healthResponse,
  ok,
  pageQuery,
  successEnvelope,
} from "../src/index.js";

describe("contracts", () => {
  it("success envelope carries data and a null error", () => {
    const env = successEnvelope(healthResponse);
    expect(env.parse(ok({ status: "ok", db: "up", version: "1" })).error).toBeNull();
  });

  it("error envelope requires a known code", () => {
    expect(() =>
      errorEnvelope.parse({ data: null, error: { code: "NOPE", messageKey: "x" } }),
    ).toThrow();
  });

  it("page query coerces strings and applies defaults", () => {
    expect(pageQuery.parse({ page: "2" })).toEqual({ page: 2, pageSize: 20 });
    expect(() => pageQuery.parse({ pageSize: "500" })).toThrow();
  });

  it("trims office names and rejects blanks", () => {
    expect(createOfficeBody.parse({ name: "  مكتب  " }).name).toBe("مكتب");
    expect(() => createOfficeBody.parse({ name: "   " })).toThrow();
  });

  it("converts to JSON Schema for OpenAPI", () => {
    // Schemas with .meta({ id }) become shared components, as the API's OpenAPI builder uses them.
    const { schemas } = z.toJSONSchema(z.globalRegistry, {
      target: "openapi-3.0",
      uri: (id) => `#/components/schemas/${id}`,
    });
    expect(schemas.Health).toMatchObject({ type: "object", required: ["status", "db", "version"] });
  });
});

describe("search contract", async () => {
  const { searchQuery } = await import("../src/search.js");
  it("needs at least 2 characters after trimming", () => {
    expect(() => searchQuery.parse({ q: " a " })).toThrow();
    expect(searchQuery.parse({ q: " قض " }).q).toBe("قض");
  });
});
