import { describe, expect, it } from "vitest";
import { prepareFields, renderBody, formatHijri } from "../src/render.js";
import { TEMPLATE_DEFS } from "../src/templates.js";
import { resolveBranding } from "../src/branding.js";
import { letterheadHtml, textToBodyHtml } from "../src/letterhead.js";

const engage = TEMPLATE_DEFS.find((t) => t.key === "engage")!;
const claim = TEMPLATE_DEFS.find((t) => t.key === "claim")!;

describe("prepareFields — autofill + field-deny (docs/04 L2)", () => {
  it("autofills from the case and keeps template defaults", () => {
    const { values } = prepareFields(claim.fields, {
      clientName: "شركة الإمداد",
      opposingParty: "مؤسسة الصقر",
      caseType: "مطالبة مالية",
      city: "الرياض",
    });
    expect(values.plaintiff).toBe("شركة الإمداد");
    expect(values.defendant).toBe("مؤسسة الصقر");
    expect(values.subject).toBe("مطالبة مالية");
    expect(values.court).toBe("المحكمة المختصة بمدينة الرياض");
  });

  it("keeps the court base value even without a case (regression)", () => {
    const noCase = prepareFields(claim.fields, null);
    expect(noCase.values.court).toBe("المحكمة المختصة");
    const withCity = prepareFields(claim.fields, { city: "جدة" });
    expect(withCity.values.court).toBe("المحكمة المختصة بمدينة جدة");
  });

  it("strips fee fields for a fee-denied role (assistant)", () => {
    const denied = prepareFields(engage.fields, null, { feesDenied: true });
    expect(denied.fields.some((f) => f.id === "feeType")).toBe(false);
    expect(denied.fields.some((f) => f.id === "feeValue")).toBe(false);
    expect(denied.values.feeType).toBeUndefined();

    const allowed = prepareFields(engage.fields, null, { feesDenied: false });
    expect(allowed.fields.some((f) => f.id === "feeType")).toBe(true);
    expect(allowed.values.feeType).toBe("نسبة من المحكوم به"); // default applied
  });
});

describe("renderBody — substitution, escaping, ellipsis", () => {
  it("substitutes values and the office token", () => {
    const html = renderBody(
      "المدّعي: {{plaintiff}} — مكتب {{office}}",
      { plaintiff: "أحمد" },
      "مكتب مُرافعة",
    );
    expect(html).toContain("أحمد");
    expect(html).toContain("مكتب مُرافعة");
    expect(html).toMatch(/^<p>.*<\/p>$/s);
  });

  it("renders empty placeholders as the Arabic ellipsis", () => {
    const html = renderBody("المبلغ: {{amount}} ريال", {}, "مكتب");
    expect(html).toContain("……");
  });

  it("HTML-escapes injected values (no markup injection)", () => {
    const html = renderBody("الوقائع: {{facts}}", { facts: "<script>x</script>" }, "مكتب");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("formatHijri (docs BR-DOC-DATE-LOCALE)", () => {
  it("formats a date in the Umm-al-Qura Hijri calendar (Arabic)", () => {
    const s = formatHijri(new Date("2026-07-24T00:00:00Z"));
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
    // Hijri year for mid-2026 is ~1447/1448 — Arabic-indic digits present.
    expect(s).toMatch(/[٠-٩]/);
  });
});

describe("letterhead", () => {
  it("escapes every text and keeps only hex colours in the CSS", () => {
    const html = letterheadHtml({
      branding: resolveBranding({
        name: "<script>x</script>",
        primaryColor: "red;}</style><img src=x>",
      }),
      title: "عنوان <b>",
      bodyHtml: textToBodyHtml("سطر <i>\nثانٍ\n\nفقرة"),
      labels: { date: "التاريخ: ١", onBehalfOf: "عن مكتب", signature: "التوقيع" },
    });
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("red;}");
    expect(html).toContain("عنوان &lt;b&gt;");
    expect(html).toContain("<p>سطر &lt;i&gt;<br/>ثانٍ</p><p>فقرة</p>");
    expect(html).toContain("default-src 'none'");
  });
});
