/**
 * Office branding for the letterhead on every generated document and PDF
 * (legacy lib/pdf/letterhead.ts). Stored per office as JSON and merged over
 * these defaults. Text is escaped when rendered; colours enter a CSS context,
 * so only strict hex values are accepted.
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
