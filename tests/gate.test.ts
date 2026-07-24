import { describe, expect, it } from "vitest";
import { CitationType, GateVerdict, KnowledgeSourceType } from "@prisma/client";
import { extractCitations, normalizeProse, runGate, toWesternDigits, type KbIndex } from "@/lib/ai/gate";

// A tiny closed KB: نظام المعاملات المدنية (art 52), نظام العمل (art 74),
// a repealed نظام ملغى (art 10), and a precedent principle.
const kb: KbIndex = {
  sources: [
    { id: "s1", citationKey: "نظام المعاملات المدنية", title: "نظام المعاملات المدنية", type: KnowledgeSourceType.STATUTE, isActive: true },
    { id: "s2", citationKey: "نظام العمل", title: "نظام العمل", type: KnowledgeSourceType.STATUTE, isActive: true },
    { id: "s3", citationKey: "نظام ملغى", title: "نظام ملغى", type: KnowledgeSourceType.STATUTE, isActive: false },
    { id: "s4", citationKey: "مبدأ قضائي — إثبات التنفيذ العقدي", title: "مبدأ قضائي: إثبات التنفيذ العقدي", type: KnowledgeSourceType.PRECEDENT, isActive: true },
  ],
  chunks: [
    { id: "c1", sourceId: "s1", articleNumber: "52" },
    { id: "c2", sourceId: "s2", articleNumber: "74" },
    { id: "c3", sourceId: "s3", articleNumber: "10" },
  ],
};

const containsAr = (out: string, s: string) => out.includes(s);

describe("normalizeProse", () => {
  it("canonicalizes the article word across proclitic/elided forms + strips tashkeel", () => {
    expect(normalizeProse("للمادة ٥٢")).toContain("المادة");
    expect(normalizeProse("بالمادة ٧٤")).toContain("المادة");
    expect(normalizeProse("وللمادّة ٥٢")).toContain("المادة");
    expect(normalizeProse("المادّة")).toBe("المادة");
  });
  it("collapses newlines to single spaces", () => {
    expect(normalizeProse("المادة ٩٩\nمن نظام العمل")).toBe("المادة ٩٩ من نظام العمل");
  });
});

describe("extractCitations", () => {
  it("extracts article-with-law and normalizes digits", () => {
    const cs = extractCitations("تنص المادة (٥٢) من نظام المعاملات المدنية على ذلك.");
    const art = cs.find((c) => c.type === CitationType.ARTICLE)!;
    expect(art.parsedArticleNumber).toBe("52");
    expect(art.parsedLawName).toContain("نظام المعاملات المدنية"); // raw phrase; matching is KB-anchored
  });
  it("toWesternDigits", () => expect(toWesternDigits("٩٩")).toBe("99"));
});

describe("runGate — safety guarantee (docs/02 §6)", () => {
  it("KEEPS a real article", () => {
    const r = runGate("بحسب المادة (٥٢) من نظام المعاملات المدنية يستحق الموكّل مطالبته.", kb);
    expect(r.verdict).toBe(GateVerdict.PASSED);
    expect(r.citations[0]!.action).toBe("KEPT");
  });

  it("BLOCKS a fabricated article and strips the sentence", () => {
    const r = runGate("الوقائع واضحة. تنص المادة (٩٩) من نظام العمل على البطلان. وعليه نطلب الرد.", kb);
    expect(r.verdict).toBe(GateVerdict.BLOCKED);
    expect(containsAr(r.finalOutput, "٩٩")).toBe(false);
    expect(r.finalOutput).toContain("الوقائع واضحة");
    expect(r.finalOutput).toContain("نطلب الرد");
  });

  // Review CRITICAL #1 — proclitic/elided article form.
  it("BLOCKS a fabrication written as «للمادة N»", () => {
    const r = runGate("استناداً للمادة ٩٩٩ من نظام العمل نطالب بالتعويض.", kb);
    expect(r.verdict).toBe(GateVerdict.BLOCKED);
    expect(containsAr(r.finalOutput, "٩٩٩")).toBe(false);
  });

  // Review CRITICAL #2 — citation spanning a newline.
  it("BLOCKS a fabrication that spans a newline", () => {
    const r = runGate("الوقائع ثابتة. تنص المادة ٩٩\nمن نظام العمل على البطلان.", kb);
    expect(r.verdict).toBe(GateVerdict.BLOCKED);
    expect(containsAr(r.finalOutput, "٩٩")).toBe(false);
    expect(r.finalOutput).toContain("الوقائع ثابتة");
  });

  // Review CRITICAL #3 — statute superset name.
  it("BLOCKS a fabricated superset statute name", () => {
    const r = runGate("استناداً إلى نظام العمل الموحد الخليجي نطلب التعويض.", kb);
    expect(r.verdict).toBe(GateVerdict.BLOCKED);
    expect(containsAr(r.finalOutput, "الموحد")).toBe(false);
  });

  // Review CRITICAL #4 — second «و»-joined article in one sentence.
  it("BLOCKS a fabricated second article joined by «و»", () => {
    const r = runGate("تنص المادة ٧٤ من نظام العمل والمادة ٥٠٠ من نظام العمل على ذلك.", kb);
    expect(r.verdict).toBe(GateVerdict.BLOCKED);
    expect(containsAr(r.finalOutput, "٥٠٠")).toBe(false);
  });

  // Review HIGH #6 — spelled-out article number (no digits) fails closed.
  it("BLOCKS an unverifiable spelled-out article", () => {
    const r = runGate("تطبّق المادة الثانية والخمسون من نظام العمل هنا.", kb);
    expect(r.verdict).toBe(GateVerdict.BLOCKED);
  });

  // Review HIGH #7 — superset law with a real article number.
  it("BLOCKS a superset law even when the article number is real elsewhere", () => {
    const r = runGate("المادة ٧٤ من نظام العمل الموحد الخليجي تدعم موقفنا.", kb);
    expect(r.verdict).toBe(GateVerdict.BLOCKED);
  });

  it("BLOCKS a law not in the KB and a repealed source", () => {
    expect(runGate("المادة (٣) من نظام الإرهاب المزعوم.", kb).verdict).toBe(GateVerdict.BLOCKED);
    expect(runGate("تنص المادة (١٠) من نظام ملغى على ذلك.", kb).verdict).toBe(GateVerdict.BLOCKED);
  });

  it("BLOCKS a bare article with no law", () => {
    expect(runGate("تطبّق المادة (٥٢) هنا.", kb).verdict).toBe(GateVerdict.BLOCKED);
  });

  it("PASSES pure reasoning with no citations", () => {
    const draft = "البيّنة على من ادّعى، وموقفنا مبني على إقرار الاستلام دون إسناد نظامي.";
    const r = runGate(draft, kb);
    expect(r.verdict).toBe(GateVerdict.PASSED);
    expect(r.citations).toHaveLength(0);
  });

  it("KEEPS a real statute and a real precedent", () => {
    expect(runGate("استناداً إلى نظام العمل نطلب المستحقات.", kb).verdict).toBe(GateVerdict.PASSED);
    expect(runGate("وبحسب مبدأ قضائي — إثبات التنفيذ العقدي يترجّح موقفنا.", kb).verdict).toBe(GateVerdict.PASSED);
  });

  it("PROPERTY: no UNMATCHED citation survives, real ones remain", () => {
    const draft =
      "المادة (٥٢) من نظام المعاملات المدنية صحيحة. للمادة ٥٠٠ من نظام العمل مختلقة. " +
      "المادة (٧٤) من نظام العمل صحيحة. المادة (١) من نظام وهمي مختلقة.";
    const r = runGate(draft, kb);
    for (const c of r.citations) {
      if (c.matchStatus === "UNMATCHED") expect(r.finalOutput.includes(c.rawText)).toBe(false);
    }
    expect(r.finalOutput).toContain("٥٢");
    expect(r.finalOutput).toContain("٧٤");
    expect(r.finalOutput).not.toContain("٥٠٠");
    expect(r.verdict).toBe(GateVerdict.BLOCKED);
  });
});
