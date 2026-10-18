import {
  createParamDecorator,
  type ExecutionContext,
  Param,
  Query,
  SetMetadata,
  Body,
} from "@nestjs/common";
import { ErrorCode } from "@murafaa/contracts";
import type { FastifyRequest } from "fastify";
import { ApiException } from "../http/api.exception.js";
import type { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe.js";

/** Metadata keys read by the OpenAPI builder. */
export const ZOD_BODY = "murafaa:zod:body";
export const ZOD_QUERY = "murafaa:zod:query";
export const ZOD_PARAMS = "murafaa:zod:params";
export const ZOD_RESPONSE = "murafaa:zod:response";
export const BINARY_BODY = "murafaa:binary-body";

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

const rawBytes = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const body = ctx.switchToHttp().getRequest<FastifyRequest>().body;
  if (!Buffer.isBuffer(body) || body.length === 0)
    throw new ApiException(ErrorCode.VALIDATION_FAILED, undefined, "errors.UPLOAD_EMPTY");
  return body;
});

/** The request body as raw bytes (application/octet-stream); documented as a binary body in OpenAPI. */
export function BinaryBody(): ParameterDecorator {
  return compose((target, propertyKey) => {
    if (propertyKey === undefined) return;
    const handler = (target as Record<string | symbol, unknown>)[propertyKey];
    Reflect.defineMetadata(BINARY_BODY, true, handler as object);
  }, rawBytes());
}
