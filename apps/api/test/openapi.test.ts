import { Controller, Get, Post, VersioningType } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { createOfficeBody, healthResponse, office, pageQuery } from "@murafaa/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Public } from "../src/common/permissions/permission.decorators.js";
import { buildOpenApi } from "../src/common/zod/openapi.js";
import { ZodBody, ZodParams, ZodQuery, ZodResponse } from "../src/common/zod/zod.decorators.js";

@Controller("things")
class ThingsController {
  @Public()
  @Get()
  @ZodResponse(healthResponse)
  list(@ZodQuery(pageQuery) _q: unknown) {}

  @Get(":id")
  @ZodResponse(office)
  one(@ZodParams(z.object({ id: z.uuid() })) _p: unknown) {}

  @Post()
  @ZodResponse(office)
  create(@ZodBody(createOfficeBody) _b: unknown) {}
}

describe("buildOpenApi", async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [DiscoveryModule],
    controllers: [ThingsController],
  }).compile();
  const app = moduleRef.createNestApplication(new FastifyAdapter());
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });
  await app.init();
  const doc = buildOpenApi(app, { prefix: "api", version: "1", title: "t", appVersion: "0" });

  it("builds versioned paths with OpenAPI path params", () => {
    expect(Object.keys(doc.paths).sort()).toEqual(["/api/v1/things", "/api/v1/things/{id}"]);
  });

  it("wraps responses in the envelope and references shared components", () => {
    const op = doc.paths["/api/v1/things"]?.get as Record<string, any>;
    const schema = op.responses["200"].content["application/json"].schema;
    expect(schema.properties.data).toEqual({ $ref: "#/components/schemas/Health" });
    expect(op.responses.default.content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/ErrorEnvelope",
    });
    expect(doc.components.schemas).toHaveProperty("Health");
    expect(doc.components.schemas).toHaveProperty("ApiError");
    expect(op.security).toEqual([]);
  });

  it("documents query, path and body inputs", () => {
    const list = doc.paths["/api/v1/things"]?.get as Record<string, any>;
    expect(
      list.parameters.map((p: { name: string; required: boolean }) => [p.name, p.required]),
    ).toEqual([
      ["page", false],
      ["pageSize", false],
    ]);
    const one = doc.paths["/api/v1/things/{id}"]?.get as Record<string, any>;
    expect(one.parameters[0]).toMatchObject({
      name: "id",
      in: "path",
      required: true,
      schema: { format: "uuid" },
    });
    const create = doc.paths["/api/v1/things"]?.post as Record<string, any>;
    expect(create.requestBody.content["application/json"].schema).toEqual({
      $ref: "#/components/schemas/CreateOfficeBody",
    });
    expect(Object.keys(create.responses)).toContain("201");
    expect(create.operationId).toBe("thingsCreate");
  });
});
