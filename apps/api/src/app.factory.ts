import "reflect-metadata";
import helmet from "@fastify/helmet";
import { VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { MAX_UPLOAD_BYTES } from "@murafaa/documents";
import { buildOpenApi } from "./common/zod/openapi.js";
import { readCookie, SESSION_COOKIE } from "./modules/auth/cookies.js";
import { SessionService } from "./modules/auth/session.service.js";
import type { Env } from "./config/env.js";
import type { LlmProvider } from "./modules/ai/llm.js";

export const API_PREFIX = "api";
export const API_VERSION = "1";

/**
 * Builds the configured app without listening, so main.ts, the OpenAPI script
 * and e2e tests all run the exact same pipeline. Call `app.init()` (or listen).
 */
export async function createApp(
  env: Env,
  overrides: { llm?: LlmProvider } = {},
): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(env, overrides),
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));

  const isProd = env.NODE_ENV === "production";
  // Swagger UI needs inline scripts, so the strict CSP is relaxed outside production only.
  await app.register(helmet, { contentSecurityPolicy: isProd ? undefined : false });
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: API_VERSION });
  app.enableShutdownHooks();
  attachSessions(app, env);
  acceptBinaryUploads(app);
  return app;
}

/** The OpenAPI document for this app. Requires the app to be initialised. */
export function openApiOf(app: NestFastifyApplication, env: Env) {
  return buildOpenApi(app, {
    prefix: API_PREFIX,
    version: API_VERSION,
    title: "Murafaa API",
    appVersion: env.APP_VERSION,
  });
}

/** Serves Swagger UI at /api/docs outside production. */
export function mountDocs(app: NestFastifyApplication, env: Env): void {
  if (env.NODE_ENV === "production") return;
  // buildOpenApi emits a plain OpenAPI 3.1 object; SwaggerModule only needs it to render.
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, () => openApiOf(app, env) as never);
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Resolve the caller's session before routing: a bearer token (mobile) or the
 * httpOnly cookie (web). Cookie-authenticated writes must come from an allowed
 * origin (CSRF defence on top of SameSite=Lax). Authorization itself stays in
 * PermissionsGuard.
 */
function attachSessions(app: NestFastifyApplication, env: Env): void {
  const sessions = app.get(SessionService);
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("onRequest", async (request) => {
      const auth = request.headers.authorization;
      const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
      const token = bearer ?? readCookie(request.headers.cookie, SESSION_COOKIE);
      if (!token) return;

      const origin = request.headers.origin;
      if (
        !bearer &&
        UNSAFE_METHODS.has(request.method) &&
        origin &&
        !env.CORS_ORIGINS.includes(origin)
      ) {
        request.sessionRejected = "ORIGIN";
        return;
      }
      const resolved = await sessions.resolve(token, request.ip);
      if (resolved === "IP_NOT_ALLOWED") {
        request.sessionRejected = "IP_NOT_ALLOWED";
        return;
      }
      if (!resolved) return;
      request.principal = resolved.principal;
      request.sessionId = resolved.sessionId;
    });
}

/**
 * File uploads arrive as raw bytes (application/octet-stream) with their
 * metadata in the query string, read by @BinaryBody. Only this content type
 * gets the larger limit; JSON bodies keep Fastify's 1 MB default. A body
 * over the limit reaches AllExceptionsFilter as a 413.
 */
function acceptBinaryUploads(app: NestFastifyApplication): void {
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer", bodyLimit: MAX_UPLOAD_BYTES },
    (_req, body, done) => done(null, body),
  );
}
