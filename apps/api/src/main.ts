import { createApp, mountDocs } from "./app.factory.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const app = await createApp(env);
mountDocs(app, env);
await app.listen({ port: env.PORT, host: "0.0.0.0" });
