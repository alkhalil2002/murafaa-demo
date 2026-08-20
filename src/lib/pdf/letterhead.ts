/**
 * Office letterhead (ديباجة المكتب) — the shared A4 RTL branding wrapper for
 * every generated PDF. Self-contained inline CSS (no external/CDN assets — CSP
 * + PDPL). Colors + contact come from the office branding record; code
 * defaults apply when an office hasn't customized it.
 *
 * NOTE: correct Arabic shaping in the PDF depends on Arabic fonts being present
 * where Chrome runs — the production container image must bundle Noto Naskh
 * Arabic (+ ideally IBM Plex Sans Arabic / Amiri).
 */

export type OfficeBranding = {
  name: string;
  tagline: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  licenseNo: string;
  primaryColor: string;
  accentColor: string;
  confidentialityNotice: string;
  logoStorageKey?: string | null;
  logoMimeType?: string | null;
  /** Full-width decorative footer band (contact icons, watermark, etc.) —
   * distinct from the logo: this replaces the whole footer visually rather
   * than sitting inline next to text. */
  footerImageStorageKey?: string | null;
  footerImageMimeType?: string | null;
};

/** Defaults mirror the prototype OFFICE object (safe placeholders). */
export const DEFAULT_BRANDING: OfficeBranding = {
  name: "مكتب مُرافعة للمحاماة والاستشارات القانونية",
  tagline: "محاماة · استشارات · تقاضٍ وتحكيم",
  phone: "+966 11 000 0000",
  email: "info@murafaa.sa",
  website: "murafaa.sa",
  address: "الرياض — المملكة العربية السعودية",
  licenseNo: "ترخيص هيئة المحامين رقم ٠٠٠٠",
  primaryColor: "#0E3A30",
  accentColor: "#C2974B",
  confidentialityNotice:
    "هذا المستند سرّي ومُعدّ خصّيصاً لموكّل المكتب، ولا يجوز تداوله أو نشره دون إذن كتابي.",
};

/**
 * Only accept a strict hex color. Colors are interpolated into the letterhead
 * <style> block, which escapeHtml cannot protect (a CSS context allows
 * `url(...)` SSRF and `}</style>...` breakout), so anything not a plain hex
 * falls back to the safe default — untrusted per-tenant branding can't inject
 * CSS/markup into the headless-Chrome render.
 */
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
function safeColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
}

/** Merge a stored branding JSON (possibly partial/null) over the defaults. */
export function resolveBranding(stored: unknown): OfficeBranding {
  const merged =
    stored && typeof stored === "object"
      ? { ...DEFAULT_BRANDING, ...(stored as Partial<OfficeBranding>) }
      : { ...DEFAULT_BRANDING };
  // Colors enter a CSS context — validate strictly (text fields are escaped).
  merged.primaryColor = safeColor(merged.primaryColor, DEFAULT_BRANDING.primaryColor);
  merged.accentColor = safeColor(merged.accentColor, DEFAULT_BRANDING.accentColor);
  return merged;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Wrap an already-escaped body (HTML paragraphs) in the A4 letterhead. `title`
 * and `signatureName` are plain text and are escaped here.
 */
export function letterheadHtml(opts: {
  branding: OfficeBranding;
  title: string;
  bodyHtml: string;
  hijriDate: string;
  /** Pre-resolved `data:` URI (never a network/storage URL — the PDF render
   * has no network access, see the CSP below). Caller reads the stored logo
   * bytes and base64-encodes them; this stays pure/sync like the rest of
   * this file. */
  logoDataUri?: string | null;
  /** Full-width footer band, same `data:` URI rule as logoDataUri. When set,
   * it replaces the plain-text foot's visual weight (it already carries
   * contact details/branding) — the dynamic date/confidentiality/signature
   * lines still render, positioned just above the image instead of on it. */
  footerImageDataUri?: string | null;
}): string {
  const b = opts.branding;
  const title = escapeHtml(opts.title);
  const hijri = escapeHtml(opts.hijriDate);
  // Only ever a data: URI we built ourselves from stored bytes — never
  // interpolate a caller-controlled string here (same CSS-injection concern
  // as safeColor above, this one via a broken-out `src` attribute).
  const logo = opts.logoDataUri && opts.logoDataUri.startsWith("data:image/") ? opts.logoDataUri : null;
  const footerImage =
    opts.footerImageDataUri && opts.footerImageDataUri.startsWith("data:image/") ? opts.footerImageDataUri : null;
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
    font-family: "IBM Plex Sans Arabic", "Noto Naskh Arabic", "Segoe UI", Tahoma, sans-serif;
    color: #1C1A15; direction: rtl; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { width: 210mm; min-height: 297mm; padding: 18mm 16mm; position: relative; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid ${b.primaryColor}; padding-bottom: 10px; }
  .office { max-width: 60%; display: flex; align-items: center; gap: 12px; }
  .office .logo { max-height: 68px; max-width: 220px; object-fit: contain; }
  .office .name { font-family: "Amiri", "Noto Naskh Arabic", serif; font-size: 22px; font-weight: 700; color: ${b.primaryColor}; }
  .office .tag { font-size: 12px; color: #5A5446; margin-top: 3px; }
  .contact { text-align: left; font-size: 11.5px; color: #5A5446; line-height: 1.9; }
  .contact .num { direction: ltr; unicode-bidi: embed; }
  .title { text-align: center; font-family: "Amiri", "Noto Naskh Arabic", serif; font-size: 20px; color: ${b.primaryColor}; margin: 26px 0 18px; }
  .body { font-size: 13.5px; line-height: 2.05; white-space: normal; }
  .body p { margin: 0 0 10px; }
  .foot { position: absolute; bottom: ${footerImage ? "26mm" : "14mm"}; left: 16mm; right: 16mm;
    border-top: 1px solid ${b.accentColor}; padding-top: 8px;
    display: flex; justify-content: space-between; align-items: flex-end; font-size: 11.5px; color: #5A5446; }
  .foot .sign { text-align: center; }
  .foot .sign .line { margin-top: 22px; border-top: 1px solid #5A5446; width: 160px; }
  .confid { margin-top: 6px; font-size: 10px; color: #8a8372; }
  .foot-band { position: absolute; bottom: 0; left: 0; width: 210mm; display: block; }
</style>
</head>
<body>
  <div class="page">
    <div class="head">
      <div class="office">
        ${
          logo
            ? `<img class="logo" src="${logo}" alt="" />`
            : `<div>
          <div class="name">${escapeHtml(b.name)}</div>
          <div class="tag">${escapeHtml(b.tagline)}</div>
        </div>`
        }
      </div>
      ${
        footerImage
          ? ""
          : `<div class="contact">
        <div class="num">${escapeHtml(b.phone)}</div>
        <div>${escapeHtml(b.email)}</div>
        <div>${escapeHtml(b.address)}</div>
      </div>`
      }
    </div>
    <div class="title">${title}</div>
    <div class="body">${opts.bodyHtml}</div>
    <div class="foot">
      <div>
        <div>التاريخ: ${hijri}</div>
        <div class="confid">${escapeHtml(b.confidentialityNotice)}</div>
        <div class="confid">${escapeHtml(b.licenseNo)}</div>
      </div>
      <div class="sign">
        <div>عن مكتب ${escapeHtml(b.name)}</div>
        <div class="line"></div>
        <div>التوقيع</div>
      </div>
    </div>
    ${footerImage ? `<img class="foot-band" src="${footerImage}" alt="" />` : ""}
  </div>
</body>
</html>`;
}
