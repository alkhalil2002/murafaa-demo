import { timingSafeEqual } from "node:crypto";
import Fastify from "fastify";
import type { Browser } from "puppeteer";
import { z } from "zod";

const renderBody = z.object({ html: z.string().min(1).max(2_000_000) });

/** Constant-time bearer check. */
function authorized(header: string | undefined, token: string): boolean {
  const given = Buffer.from(header?.startsWith("Bearer ") ? header.slice(7) : "");
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * HTML → A4 PDF with headless Chrome (owner decision 2026-07-24: correct
 * Arabic shaping and RTL). The page gets no JavaScript and no network: every
 * request except inline data: URIs is aborted, so tenant-supplied text in the
 * HTML cannot make Chrome fetch anything (SSRF). Only the API calls this
 * service, with a shared bearer token; it is not exposed publicly.
 */
export function buildServer(opts: {
  token: string;
  browser: () => Promise<Browser>;
  renderTimeoutMs?: number;
}) {
  const app = Fastify({ bodyLimit: 2_500_000, logger: false });
  const timeout = opts.renderTimeoutMs ?? 20_000;

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/render", async (req, reply) => {
    if (!authorized(req.headers.authorization, opts.token))
      return reply.status(401).send({ error: "UNAUTHENTICATED" });
    const parsed = renderBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: "VALIDATION_FAILED" });

    const page = await (await opts.browser()).newPage();
    try {
      await page.setJavaScriptEnabled(false);
      await page.setRequestInterception(true);
      page.on("request", (r) => (r.url().startsWith("data:") ? void r.continue() : void r.abort()));
      await page.setContent(parsed.data.html, { waitUntil: "load", timeout });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
        timeout,
      });
      return reply.type("application/pdf").send(Buffer.from(pdf));
    } finally {
      await page.close().catch(() => undefined);
    }
  });

  return app;
}

/** One shared Chrome; relaunched if it crashes or disconnects. */
export function browserPool(launch: () => Promise<Browser>) {
  let current: Promise<Browser> | null = null;
  const get = async (): Promise<Browser> => {
    if (!current) {
      current = launch().then((b) => {
        b.on("disconnected", () => {
          current = null;
        });
        return b;
      });
      current.catch(() => {
        current = null;
      });
    }
    const b = await current;
    if (!b.connected) {
      current = null;
      return get();
    }
    return b;
  };
  const close = async () => {
    const b = await current?.catch(() => null);
    current = null;
    await b?.close();
  };
  return { get, close };
}
