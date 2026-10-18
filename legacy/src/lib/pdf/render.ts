import type { Browser } from "puppeteer";

/**
 * Server-side HTML → PDF via headless Chrome (puppeteer). Approved stack
 * addition (owner decision 2026-07-24): Chrome renders Arabic shaping + RTL +
 * the letterhead exactly as previewed, which server PDF libraries can't match.
 *
 * A single browser instance is reused across renders within a server instance.
 * On Cloud Run the container image MUST include Arabic fonts (e.g. fonts-noto,
 * Noto Naskh Arabic) or glyphs render as tofu.
 */

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { default: puppeteer } = await import("puppeteer");
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      // If the browser crashes/disconnects, drop the cached instance so the
      // next render transparently relaunches (otherwise a dead browser would
      // break all PDF generation until restart).
      browser.on("disconnected", () => {
        browserPromise = null;
      });
      return browser;
    })().catch((err) => {
      browserPromise = null; // allow retry on next call
      throw new Error(
        `PDF_ENGINE_UNAVAILABLE: could not launch headless Chrome (${
          err instanceof Error ? err.message : String(err)
        })`,
      );
    });
  }
  const browser = await browserPromise;
  // Guard against a browser that disconnected between renders.
  if (!browser.connected) {
    browserPromise = null;
    return getBrowser();
  }
  return browser;
}

/** Render a full HTML document to an A4 PDF buffer. */
export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Inline, self-contained HTML (no external assets) — "load" is sufficient.
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      // The letterhead template owns its own page padding.
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

/** For graceful shutdown / tests. */
export async function closePdfEngine(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    if (b) await b.close();
  }
}
