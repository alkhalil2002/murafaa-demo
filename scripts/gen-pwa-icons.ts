/**
 * Renders the PWA icons from the brand mark.
 *
 * Uses puppeteer, which is already a dependency for PDF rendering — no image
 * toolchain or new package needed. Re-run after any brand change:
 *   npx tsx scripts/gen-pwa-icons.ts
 *
 * Maskable icons carry ~20% safe-area padding so Android's adaptive-icon mask
 * cannot crop the seal.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";

const BENCH = "#0e3a30";
const GOLD = "#c2974b";

/** The brand seal: gold-ringed circle with the scales, on the bench green. */
function svg(size: number, maskable: boolean): string {
  const pad = maskable ? size * 0.2 : size * 0.1;
  const inner = size - pad * 2;
  const c = size / 2;
  const r = inner / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BENCH}"/>
  <circle cx="${c}" cy="${c}" r="${r * 0.92}" fill="none" stroke="${GOLD}" stroke-width="${size * 0.022}"/>
  <g stroke="${GOLD}" stroke-width="${size * 0.028}" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M${c} ${c - r * 0.5} V${c + r * 0.52}"/>
    <path d="M${c - r * 0.3} ${c + r * 0.52} H${c + r * 0.3}"/>
    <path d="M${c - r * 0.55} ${c - r * 0.3} H${c + r * 0.55}"/>
    <path d="M${c - r * 0.55} ${c - r * 0.3} l${-r * 0.16} ${r * 0.34} a${r * 0.24} ${r * 0.24} 0 0 0 ${r * 0.32} 0 Z"/>
    <path d="M${c + r * 0.55} ${c - r * 0.3} l${-r * 0.16} ${r * 0.34} a${r * 0.24} ${r * 0.24} 0 0 0 ${r * 0.32} 0 Z"/>
    <circle cx="${c}" cy="${c - r * 0.52}" r="${size * 0.026}" fill="${GOLD}"/>
  </g>
</svg>`;
}

async function main() {
  const { default: puppeteer } = await import("puppeteer");
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();

  const targets = [
    { size: 192, maskable: false, name: "icon-192.png" },
    { size: 512, maskable: false, name: "icon-512.png" },
    { size: 512, maskable: true, name: "icon-maskable-512.png" },
    { size: 180, maskable: false, name: "apple-touch-icon.png" },
  ];

  for (const t of targets) {
    await page.setViewport({ width: t.size, height: t.size, deviceScaleFactor: 1 });
    await page.setContent(
      `<body style="margin:0">${svg(t.size, t.maskable)}</body>`,
      { waitUntil: "load" },
    );
    const buf = (await page.screenshot({ omitBackground: false, type: "png" })) as Buffer;
    const out = path.join("public", "icons", t.name);
    await writeFile(out, buf);
    console.info(`wrote ${out} (${t.size}px${t.maskable ? ", maskable" : ""})`);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
