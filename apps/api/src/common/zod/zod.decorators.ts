import { Body, Param, Query, SetMetadata } from "@nestjs/common";
import type { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe.js";

/** Metadata keys read by the OpenAPI builder. */
export const ZOD_BODY = "murafaa:zod:body";
export const ZOD_QUERY = "murafaa:zod:query";
export const ZOD_PARAMS = "murafaa:zod:params";
export const ZOD_RESPONSE = "murafaa:zod:response";

function recordOnHandler(key: string, schema: z.ZodType): ParameterDecorator {
  return (target, propertyKey) => {
    if (propertyKey === undefined) return;
    const handler = (target as Record<string | symbol, unknown>)[propertyKey];
    Reflect.defineMetadata(key, schema, handler as object);
  };
}

function compose(...decorators: ParameterDecorator[]): ParameterDecorator {
  return (target, key, index) => decorators.forEach((d) => d(target, key, index));
}

/** Validated request body; also documents it in OpenAPI. */
export function ZodBody(schema: z.ZodType): ParameterDecorator {
  return compose(recordOnHandler(ZOD_BODY, schema), Body(new ZodValidationPipe(schema)));
}

/** Validated query string (must be a z.object). */
export function ZodQuery(schema: z.ZodObject): ParameterDecorator {
  return compose(recordOnHandler(ZOD_QUERY, schema), Query(new ZodValidationPipe(schema)));
}

/** Validated path params (must be a z.object). */
export function ZodParams(schema: z.ZodObject): ParameterDecorator {
  return compose(recordOnHandler(ZOD_PARAMS, schema), Param(new ZodValidationPipe(schema)));
}

/** The `data` schema of a successful response (the envelope is added automatically). */
export function ZodResponse(schema: z.ZodType): MethodDecorator {
  return SetMetadata(ZOD_RESPONSE, schema);
}
