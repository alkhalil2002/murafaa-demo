import qrcode from "qrcode-generator";
import type { OfficeBranding } from "./branding.js";
import { escapeHtml } from "./html.js";

/**
 * A QR code as a self-contained SVG (one path, no external assets), for the
 * ZATCA phase-1 payload. Error correction M, as ZATCA's samples use.
 */
export function qrSvg(data: string, sizePx = 132): string {
  const qr = qrcode(0, "M");
  qr.addData(data, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  let d = "";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + quiet},${r + quiet}h1v1h-1z`;
  const box = n + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${box} ${box}" shape-rendering="crispEdges"><rect width="${box}" height="${box}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

/**
 * The same QR as block characters for a terminal (light modules are drawn,
 * for the usual dark background), e.g. to scan an authenticator secret.
 */
export function qrTerminal(data: string): string {
  const qr = qrcode(0, "M");
  qr.addData(data, "Byte");
  qr.make();
  return qr.createASCII(1, 2);
}

/** Fixed wording on the invoice, from @murafaa/i18n (this package holds no UI text). */
export type TaxInvoiceLabels = {
  title: string;
  number: string;
  issueDate: string;
  seller: string;
  buyer: string;
  vatNumber: string;
  crNumber: string;
  address: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineNet: string;
  net: string;
  vat: string;
  total: string;
  qrNote: string;
};

export type TaxInvoiceData = {
  number: string;
  /** Already formatted (Gregorian and Hijri). */
  issueDate: string;
  seller: { name: string; vatNumber: string; crNumber: string | null; address: string | null };
  buyer: { name: string; vatNumber: string | null };
  /** Amounts already formatted (formatSar). */
  items: Array<{ description: string; quantity: string; unitPrice: string; lineNet: string }>;
  net: string;
  vat: string;
  total: string;
  qrPayload: string;
};

/**
 * A ZATCA phase-1 tax invoice (فاتورة ضريبية / مبسطة) on A4, RTL, with the
 * seller's VAT number and the QR. Every text is escaped; colours come from
 * resolveBranding. Self-contained like the letterhead (CSP forbids fetches).
 */
export function taxInvoiceHtml(opts: {
  branding: OfficeBranding;
  labels: TaxInvoiceLabels;
  invoice: TaxInvoiceData;
}): string {
  const b = opts.branding;
  const l = opts.labels;
  const inv = opts.invoice;
  const e = escapeHtml;
  const party = (title: string, name: string, rows: Array<[string, string | null]>) => `
    <div class="party">
      <div class="ph">${e(title)}</div>
      <div class="pn">${e(name)}</div>
      ${rows
        .filter(([, v]) => v)
        .map(
          ([k, v]) =>
            `<div class="pr"><span>${e(k)}</span> <span class="num">${e(v!)}</span></div>`,
        )
        .join("")}
    </div>`;
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src local;" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: "IBM Plex Sans Arabic", "Noto Naskh Arabic", "Noto Sans Arabic", Tahoma, sans-serif;
    color: #1C1A15; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 297mm; padding: 16mm; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid ${b.primaryColor}; padding-bottom: 10px; }
  .office .name { font-family: "Amiri", "Noto Naskh Arabic", serif; font-size: 22px; font-weight: 700; color: ${b.primaryColor}; }
  .office .tag { font-size: 12px; color: #5A5446; margin-top: 3px; }
  .title { font-family: "Amiri", "Noto Naskh Arabic", serif; font-size: 22px; color: ${b.primaryColor}; text-align: left; }
  .meta { font-size: 12.5px; text-align: left; margin-top: 4px; line-height: 1.8; }
  .num { direction: ltr; unicode-bidi: embed; }
  .parties { display: flex; gap: 12px; margin: 18px 0; }
  .party { flex: 1; border: 1px solid ${b.accentColor}; border-radius: 8px; padding: 10px 12px; font-size: 12.5px; line-height: 1.8; }
  .ph { color: #5A5446; font-size: 11.5px; }
  .pn { font-weight: 700; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { background: ${b.primaryColor}; color: #fff; padding: 7px 8px; text-align: right; font-weight: 600; }
  td { border-bottom: 1px solid #eadfc8; padding: 7px 8px; }
  td.amt, th.amt { text-align: left; }
  .bottom { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 16px; }
  .totals { width: 55%; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eadfc8; }
  .totals .grand { font-weight: 700; font-size: 15px; border-bottom: 2px solid ${b.primaryColor}; }
  .qr { text-align: center; font-size: 10px; color: #5A5446; }
</style>
</head>
<body>
  <div class="page">
    <div class="head">
      <div class="office">
        <div class="name">${e(b.name)}</div>
        <div class="tag">${e(b.tagline)}</div>
      </div>
      <div>
        <div class="title">${e(l.title)}</div>
        <div class="meta">${e(l.number)}: <span class="num">${e(inv.number)}</span><br/>${e(l.issueDate)}: ${e(inv.issueDate)}</div>
      </div>
    </div>
    <div class="parties">
      ${party(l.seller, inv.seller.name, [
        [l.vatNumber, inv.seller.vatNumber],
        [l.crNumber, inv.seller.crNumber],
        [l.address, inv.seller.address],
      ])}
      ${party(l.buyer, inv.buyer.name, [[l.vatNumber, inv.buyer.vatNumber]])}
    </div>
    <table>
      <thead><tr><th>${e(l.description)}</th><th class="amt">${e(l.quantity)}</th><th class="amt">${e(l.unitPrice)}</th><th class="amt">${e(l.lineNet)}</th></tr></thead>
      <tbody>
        ${inv.items
          .map(
            (it) =>
              `<tr><td>${e(it.description)}</td><td class="amt">${e(it.quantity)}</td><td class="amt">${e(it.unitPrice)}</td><td class="amt">${e(it.lineNet)}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>
    <div class="bottom">
      <div class="qr">${qrSvg(inv.qrPayload)}<div>${e(l.qrNote)}</div></div>
      <div class="totals">
        <div><span>${e(l.net)}</span><span>${e(inv.net)}</span></div>
        <div><span>${e(l.vat)}</span><span>${e(inv.vat)}</span></div>
        <div class="grand"><span>${e(l.total)}</span><span>${e(inv.total)}</span></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
