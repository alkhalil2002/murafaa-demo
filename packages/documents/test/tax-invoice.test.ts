import { describe, expect, it } from "vitest";
import { resolveBranding } from "../src/branding.js";
import { qrSvg, qrTerminal, taxInvoiceHtml, type TaxInvoiceLabels } from "../src/tax-invoice.js";

const labels = Object.fromEntries(
  [
    "title",
    "number",
    "issueDate",
    "seller",
    "buyer",
    "vatNumber",
    "crNumber",
    "address",
    "description",
    "quantity",
    "unitPrice",
    "lineNet",
    "net",
    "vat",
    "total",
    "qrNote",
  ].map((k) => [k, `L:${k}`]),
) as TaxInvoiceLabels;

describe("tax invoice", () => {
  it("draws the QR as one self-contained SVG with the three finder patterns", () => {
    const svg = qrSvg("AQxCb2JzIFJlY29yZHM=");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toMatch(/href|<script|<image/);
    // top-left finder: the first module (after the 2-module quiet zone) is dark
    expect(svg).toContain("M2,2h1v1h-1z");
    expect(qrSvg("same")).toBe(qrSvg("same"));
  });

  it("escapes every text and prints the seller VAT number and totals", () => {
    const html = taxInvoiceHtml({
      branding: resolveBranding({ name: "<b>مكتب</b>" }),
      labels,
      invoice: {
        number: "INV-1043",
        issueDate: "2026-10-18",
        seller: { name: "مكتب", vatNumber: "300000000000003", crNumber: null, address: "الرياض" },
        buyer: { name: "<script>x</script>", vatNumber: null },
        items: [
          { description: "أتعاب & استشارة", quantity: "1", unitPrice: "1,000", lineNet: "1,000" },
        ],
        net: "1,000.00",
        vat: "150.00",
        total: "1,150.00",
        qrPayload: "AQ==",
      },
    });
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).toContain("أتعاب &amp; استشارة");
    expect(html).toContain("300000000000003");
    expect(html).not.toContain("L:crNumber"); // empty rows are left out
    expect(html).toContain("L:total");
  });
});

describe("terminal QR", () => {
  it("draws a square block-character QR, the same for the same data", () => {
    const rows = qrTerminal("otpauth://totp/x?secret=JBSWY3DPEHPK3PXP").split("\n");
    expect(rows.length).toBeGreaterThan(10);
    expect(new Set(rows.map((r) => r.length)).size).toBe(1);
    expect(rows.join("")).toMatch(/[█▀▄]/);
    expect(qrTerminal("same")).toBe(qrTerminal("same"));
  });
});
