import { Inject, Injectable } from "@nestjs/common";
import { ErrorCode } from "@murafaa/contracts";
import { ENV, type Env } from "../../config/env.js";
import { ApiException } from "../http/api.exception.js";

const unavailable = () =>
  new ApiException(ErrorCode.UNAVAILABLE, undefined, "errors.PDF_UNAVAILABLE");

/**
 * Client for the internal PDF service (apps/pdf: headless Chrome with Arabic
 * fonts, owner decision 2026-07-24). When the service is not configured or
 * fails, callers get UNAVAILABLE; no placeholder file is ever produced.
 */
@Injectable()
export class PdfClient {
  constructor(@Inject(ENV) private readonly env: Env) {}

  async render(html: string): Promise<Buffer> {
    const { PDF_SERVICE_URL: url, PDF_SERVICE_TOKEN: token } = this.env;
    if (!url || !token) throw unavailable();
    let res: Response;
    try {
      res = await fetch(new URL("/render", url), {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ html }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw unavailable();
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    if (!res.ok || bytes.subarray(0, 5).toString() !== "%PDF-") throw unavailable();
    return bytes;
  }
}
