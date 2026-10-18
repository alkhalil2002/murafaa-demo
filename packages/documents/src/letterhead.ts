import type { OfficeBranding } from "./branding.js";
import { escapeHtml } from "./html.js";

/** Fixed wording on the letterhead, from @murafaa/i18n (this package holds no UI text). */
export type LetterheadLabels = {
  /** e.g. "التاريخ: {date}" already filled in. */
  date: string;
  /** e.g. "عن مكتب {name}" already filled in. */
  onBehalfOf: string;
  signature: string;
};

/**
 * The A4 RTL office letterhead around every generated PDF (legacy
 * lib/pdf/letterhead.ts). Self-contained: inline CSS, no external assets,
 * and a CSP that forbids any fetch. `bodyHtml` must already be escaped
 * (renderBody does it); every other text is escaped here. Colours come from
 * resolveBranding, which only lets strict hex values into the CSS.
 */
export function letterheadHtml(opts: {
  branding: OfficeBranding;
  title: string;
  bodyHtml: string;
  labels: LetterheadLabels;
}): string {
  const b = opts.branding;
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src local;" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "IBM Plex Sans Arabic", "Noto Naskh Arabic", "Noto Sans Arabic", "Segoe UI", Tahoma, sans-serif;
    color: #1C1A15; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { width: 210mm; min-height: 297mm; padding: 18mm 16mm; position: relative; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid ${b.primaryColor}; padding-bottom: 10px; }
  .office { max-width: 60%; }
  .office .name { font-family: "Amiri", "Noto Naskh Arabic", serif; font-size: 22px; font-weight: 700; color: ${b.primaryColor}; }
  .office .tag { font-size: 12px; color: #5A5446; margin-top: 3px; }
  .contact { text-align: left; font-size: 11.5px; color: #5A5446; line-height: 1.9; }
  .contact .num { direction: ltr; unicode-bidi: embed; }
  .title { text-align: center; font-family: "Amiri", "Noto Naskh Arabic", serif; font-size: 20px; color: ${b.primaryColor}; margin: 26px 0 18px; }
  .body { font-size: 13.5px; line-height: 2.05; white-space: normal; }
  .body p { margin: 0 0 10px; }
  .foot { position: absolute; bottom: 14mm; left: 16mm; right: 16mm;
    border-top: 1px solid ${b.accentColor}; padding-top: 8px;
    display: flex; justify-content: space-between; align-items: flex-end; font-size: 11.5px; color: #5A5446; }
  .foot .sign { text-align: center; }
  .foot .sign .line { margin-top: 22px; border-top: 1px solid #5A5446; width: 160px; }
  .confid { margin-top: 6px; font-size: 10px; color: #8a8372; }
</style>
</head>
<body>
  <div class="page">
    <div class="head">
      <div class="office">
        <div class="name">${escapeHtml(b.name)}</div>
        <div class="tag">${escapeHtml(b.tagline)}</div>
      </div>
      <div class="contact">
        <div class="num">${escapeHtml(b.phone)}</div>
        <div>${escapeHtml(b.email)}</div>
        <div>${escapeHtml(b.address)}</div>
      </div>
    </div>
    <div class="title">${escapeHtml(opts.title)}</div>
    <div class="body">${opts.bodyHtml}</div>
    <div class="foot">
      <div>
        <div>${escapeHtml(opts.labels.date)}</div>
        <div class="confid">${escapeHtml(b.confidentialityNotice)}</div>
        <div class="confid">${escapeHtml(b.licenseNo)}</div>
      </div>
      <div class="sign">
        <div>${escapeHtml(opts.labels.onBehalfOf)}</div>
        <div class="line"></div>
        <div>${escapeHtml(opts.labels.signature)}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Plain text (a hearing's client report) as escaped paragraphs for the letterhead body. */
export function textToBodyHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}
