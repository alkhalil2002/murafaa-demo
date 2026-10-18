import { type INestApplication, RequestMethod } from "@nestjs/common";
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants.js";
import { DiscoveryService, MetadataScanner } from "@nestjs/core";
import { errorEnvelope } from "@murafaa/contracts";
import { z } from "zod";
import { IS_PUBLIC } from "../permissions/permission.decorators.js";
import { ZOD_BODY, ZOD_PARAMS, ZOD_QUERY, ZOD_RESPONSE } from "./zod.decorators.js";

type JsonSchema = Record<string, unknown>;
type Operation = Record<string, unknown>;

export type OpenApiDocument = {
  openapi: "3.1.0";
  info: { title: string; version: string };
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, JsonSchema> };
};

/** Point zod's local refs (#/$defs/X, #/definitions/X) at OpenAPI components. */
function rewriteRefs(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(rewriteRefs);
  if (node === null || typeof node !== "object") return node;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) =>
      key === "$ref" && typeof value === "string"
        ? [key, value.replace(/^#\/(\$defs|definitions)\//, "#/components/schemas/")]
        : [key, rewriteRefs(value)],
    ),
  );
}

/**
 * Builds the OpenAPI 3.1 document from the Zod contracts attached to routes
 * (@ZodBody/@ZodQuery/@ZodParams/@ZodResponse), using zod 4's native JSON
 * Schema output. Schemas with `.meta({ id })` become shared components.
 * This replaces nestjs-zod until it supports NestJS 12 (docs/adr/0001).
 */
export function buildOpenApi(
  app: INestApplication,
  options: { prefix: string; version: string; title: string; appVersion: string },
): OpenApiDocument {
  const components: Record<string, JsonSchema> = {};

  const toSchema = (schema: z.ZodType, io: "input" | "output"): JsonSchema => {
    const json = rewriteRefs(z.toJSONSchema(schema, { io, unrepresentable: "any" })) as JsonSchema;
    const { $schema: _s, $defs, definitions, ...root } = json;
    Object.assign(components, $defs ?? {}, definitions ?? {});
    return root;
  };

  const parametersOf = (
    schema: z.ZodObject | undefined,
    location: "query" | "path",
    pathNames: string[],
  ) => {
    if (!schema) {
      return location === "path"
        ? pathNames.map((name) => ({
            name,
            in: "path",
            required: true,
            schema: { type: "string" },
          }))
        : [];
    }
    return Object.entries(schema.shape).map(([name, field]) => ({
      name,
      in: location,
      required: location === "path" || !(field as z.ZodType).safeParse(undefined).success,
      schema: toSchema(field as z.ZodType, "input"),
    }));
  };

  const errorRef = toSchema(errorEnvelope, "output");
  const paths: OpenApiDocument["paths"] = {};
  const scanner = app.get(MetadataScanner);

  for (const wrapper of app.get(DiscoveryService).getControllers()) {
    const { metatype } = wrapper;
    if (!metatype || typeof metatype !== "function") continue;
    const controllerPath = String(Reflect.getMetadata(PATH_METADATA, metatype) ?? "");
    const controllerName = metatype.name.replace(/Controller$/, "");
    const prototype = metatype.prototype as Record<string, unknown>;

    for (const methodName of scanner.getAllMethodNames(prototype)) {
      const handler = prototype[methodName] as object;
      const routePath = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
      if (routePath === undefined) continue;
      const method =
        RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod].toLowerCase();

      const fullPath =
        "/" +
        [options.prefix, `v${options.version}`, controllerPath, routePath]
          .flatMap((p) => p.split("/"))
          .filter(Boolean)
          .map((seg) => (seg.startsWith(":") ? `{${seg.slice(1)}}` : seg))
          .join("/");
      const pathNames = [...fullPath.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "");

      const body = Reflect.getMetadata(ZOD_BODY, handler) as z.ZodType | undefined;
      const response = Reflect.getMetadata(ZOD_RESPONSE, handler) as z.ZodType | undefined;
      const isPublic = Boolean(
        Reflect.getMetadata(IS_PUBLIC, handler) ?? Reflect.getMetadata(IS_PUBLIC, metatype),
      );

      const operation: Operation = {
        operationId: `${controllerName.charAt(0).toLowerCase()}${controllerName.slice(1)}${methodName.charAt(0).toUpperCase()}${methodName.slice(1)}`,
        tags: [controllerName],
        parameters: [
          ...parametersOf(
            Reflect.getMetadata(ZOD_PARAMS, handler) as z.ZodObject | undefined,
            "path",
            pathNames,
          ),
          ...parametersOf(
            Reflect.getMetadata(ZOD_QUERY, handler) as z.ZodObject | undefined,
            "query",
            [],
          ),
        ],
        responses: {
          [String(
            Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? (method === "post" ? 201 : 200),
          )]: {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data", "error"],
                  properties: {
                    data: response ? toSchema(response, "output") : {},
                    error: { type: "null" },
                  },
                },
              },
            },
          },
          default: { description: "Error", content: { "application/json": { schema: errorRef } } },
        },
        ...(isPublic ? { security: [] } : {}),
      };
      if (body) {
        operation.requestBody = {
          required: true,
          content: { "application/json": { schema: toSchema(body, "input") } },
        };
      }
      (paths[fullPath] ??= {})[method] = operation;
    }
  }

  return {
    openapi: "3.1.0",
    info: { title: options.title, version: options.appVersion },
    paths,
    components: { schemas: components },
  };
}
