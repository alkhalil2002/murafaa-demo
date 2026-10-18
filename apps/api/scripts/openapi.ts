import { writeFile } from "node:fs/promises";
import { createApp, openApiOf } from "../src/app.factory.js";
import { loadEnv } from "../src/config/env.js";

/**
 * Writes apps/api/openapi.json, which packages/sdk generates the client from.
 * No server or database connection is needed (postgres-js connects lazily).
 */
const env = loadEnv({
  DATABASE_URL: "postgres://unused@localhost:5432/unused",
  LOG_LEVEL: "warn",
  AUTH_SECRET: "openapi-generation-only-not-a-real-secret",
  ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
  ...process.env,
  NODE_ENV: "test",
});
const app = await createApp(env);
await app.init();
const out = new URL("../../openapi.json", import.meta.url);
await writeFile(out, `${JSON.stringify(openApiOf(app, env), null, 2)}\n`);
await app.close();
console.log(`wrote ${out.pathname}`);
