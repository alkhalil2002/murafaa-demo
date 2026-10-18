import puppeteer from "puppeteer";
import { z } from "zod";
import { browserPool, buildServer } from "./server.js";

const env = z
  .object({
    PORT: z.coerce.number().int().default(4100),
    PDF_SERVICE_TOKEN: z.string().min(32),
  })
  .parse(process.env);

const pool = browserPool(() =>
  puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  }),
);
const app = buildServer({ token: env.PDF_SERVICE_TOKEN, browser: pool.get });
await app.listen({ port: env.PORT, host: "0.0.0.0" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app
      .close()
      .then(pool.close)
      .then(() => process.exit(0));
  });
}
