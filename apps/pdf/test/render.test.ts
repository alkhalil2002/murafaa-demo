import puppeteer from "puppeteer";
import { afterAll, describe, expect, it } from "vitest";
import { browserPool, buildServer } from "../src/server.js";

const TOKEN = "test-token-0123456789-0123456789-abcdef";
const pool = browserPool(() => puppeteer.launch({ headless: true, args: ["--no-sandbox"] }));
const app = buildServer({ token: TOKEN, browser: pool.get });

afterAll(async () => {
  await app.close();
  await pool.close();
});

const render = (html: string, token = TOKEN) =>
  app.inject({
    method: "POST",
    url: "/render",
    headers: { authorization: `Bearer ${token}` },
    payload: { html },
  });

describe("pdf service", () => {
  it("renders Arabic RTL HTML to a PDF", async () => {
    const res = await render(
      '<!doctype html><html lang="ar" dir="rtl"><body><p>صحيفة دعوى — مطالبة مالية</p></body></html>',
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("refuses a missing or wrong token and an empty body", async () => {
    expect((await render("<p>x</p>", "wrong")).statusCode).toBe(401);
    expect(
      (await app.inject({ method: "POST", url: "/render", payload: { html: "<p>x</p>" } }))
        .statusCode,
    ).toBe(401);
    expect((await render("")).statusCode).toBe(400);
  });

  it("never fetches remote resources while rendering", async () => {
    let hits = 0;
    const probe = (await import("node:http")).createServer((_req, res) => {
      hits++;
      res.end("x");
    });
    await new Promise<void>((r) => probe.listen(0, r));
    const port = (probe.address() as { port: number }).port;
    const res = await render(
      `<html><head><link rel="stylesheet" href="http://127.0.0.1:${port}/a.css"></head>` +
        `<body><img src="http://127.0.0.1:${port}/b.png"><script>fetch("http://127.0.0.1:${port}/c")</script></body></html>`,
    );
    probe.close();
    expect(res.statusCode).toBe(200);
    expect(hits).toBe(0);
  });
});
