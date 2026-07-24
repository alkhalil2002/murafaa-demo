import { describe, expect, it } from "vitest";
import { ConflictSeverity, ConflictType } from "@prisma/client";
import {
  detectConflicts,
  duplicateOpposingParties,
  highestSeverity,
  normalizeName,
  type ConflictCandidates,
} from "@/lib/conflict/engine";

const empty: ConflictCandidates = { clients: [], leads: [], otherCases: [] };

describe("normalizeName (Arabic-aware hardening)", () => {
  it("treats alef/ya/ta-marbuta variants and tashkeel as equal", () => {
    expect(normalizeName("إبراهيم")).toBe(normalizeName("ابراهيم"));
    expect(normalizeName("شركة الأفق")).toBe(normalizeName("شركه الافق"));
    expect(normalizeName("مُحَمَّد")).toBe(normalizeName("محمد"));
    expect(normalizeName("  شركة   الإمداد  ")).toBe(normalizeName("شركة الامداد"));
  });
});

describe("docs/06 §4 — conflict detection", () => {
  it("rule 1: opponent is a registered client → HIGH", () => {
    const found = detectConflicts(
      { id: "c1", opposingParty: "شركة النخبة", clientName: "عميلنا" },
      { ...empty, clients: [{ id: "cl1", name: "شركة النخبه" }] },
    );
    expect(found).toHaveLength(1);
    expect(found[0]!.conflictType).toBe(ConflictType.OPPONENT_IS_CLIENT);
    expect(found[0]!.severity).toBe(ConflictSeverity.HIGH);
    expect(found[0]!.matchedClientId).toBe("cl1");
  });

  it("rule 2: opponent is a lead → MEDIUM (single flag even if several match)", () => {
    const found = detectConflicts(
      { id: "c1", opposingParty: "خالد الفهد", clientName: null },
      {
        ...empty,
        leads: [
          { id: "l1", name: "خالد الفهد" },
          { id: "l2", name: "خالد الفهد" },
        ],
      },
    );
    const leadFlags = found.filter(
      (f) => f.conflictType === ConflictType.OPPONENT_IS_LEAD,
    );
    expect(leadFlags).toHaveLength(1);
    expect(leadFlags[0]!.severity).toBe(ConflictSeverity.MEDIUM);
  });

  it("rule 3: opponent is our client in other cases → HIGH, lists all cases", () => {
    const found = detectConflicts(
      { id: "c1", opposingParty: "مؤسسة البناء", clientName: "عميلنا" },
      {
        ...empty,
        otherCases: [
          { id: "c2", title: "قضية أ", clientName: "مؤسسة البناء", opposingParty: "x" },
          { id: "c3", title: "قضية ب", clientName: "مؤسسة البناء", opposingParty: "y" },
        ],
      },
    );
    const f = found.find(
      (x) => x.conflictType === ConflictType.OPPONENT_IS_OUR_CLIENT_OTHER_CASE,
    )!;
    expect(f.severity).toBe(ConflictSeverity.HIGH);
    expect(f.matchedCaseIds).toEqual(["c2", "c3"]);
    expect(f.messageParams.cases).toContain("قضية أ");
  });

  it("rule 4: our client is the opponent in another case → HIGH", () => {
    const found = detectConflicts(
      { id: "c1", opposingParty: "طرف آخر", clientName: "شركة الإمداد" },
      {
        ...empty,
        otherCases: [
          { id: "c9", title: "قضية ج", clientName: "غيره", opposingParty: "شركة الامداد" },
        ],
      },
    );
    const f = found.find(
      (x) => x.conflictType === ConflictType.OUR_CLIENT_IS_OPPONENT_OTHER_CASE,
    )!;
    expect(f).toBeTruthy();
    expect(f.severity).toBe(ConflictSeverity.HIGH);
    expect(f.matchedCaseIds).toEqual(["c9"]);
  });

  it("empty opponent skips rules 1–3; empty client skips rule 4", () => {
    const found = detectConflicts(
      { id: "c1", opposingParty: "", clientName: "" },
      { clients: [{ id: "x", name: "" }], leads: [], otherCases: [] },
    );
    expect(found).toHaveLength(0);
  });

  it("rule 3 ignores other cases with an empty client (non-empty guard)", () => {
    const found = detectConflicts(
      { id: "c1", opposingParty: "الخصم", clientName: null },
      {
        ...empty,
        otherCases: [
          { id: "c2", title: "بلا عميل", clientName: "", opposingParty: "z" },
        ],
      },
    );
    expect(found).toHaveLength(0);
  });

  it("no conflict → empty", () => {
    const found = detectConflicts(
      { id: "c1", opposingParty: "لا أحد", clientName: "عميل" },
      empty,
    );
    expect(found).toHaveLength(0);
  });

  it("stores the original (trimmed) name, not the normalized one", () => {
    const found = detectConflicts(
      { id: "c1", opposingParty: "  شركة النخبة  ", clientName: null },
      { ...empty, clients: [{ id: "cl1", name: "شركة النخبة" }] },
    );
    expect(found[0]!.matchedName).toBe("شركة النخبة");
  });
});

describe("severity + coarse duplicate-party detection", () => {
  it("highestSeverity prefers HIGH", () => {
    expect(
      highestSeverity([
        { severity: ConflictSeverity.MEDIUM } as never,
        { severity: ConflictSeverity.HIGH } as never,
      ]),
    ).toBe(ConflictSeverity.HIGH);
    expect(highestSeverity([])).toBeNull();
  });

  it("duplicateOpposingParties groups the same party across cases", () => {
    const dups = duplicateOpposingParties([
      { id: "1", opposingParty: "شركة س" },
      { id: "2", opposingParty: "شركه س" },
      { id: "3", opposingParty: "طرف مختلف" },
      { id: "4", opposingParty: "" },
    ]);
    expect(dups).toHaveLength(1);
    expect(dups[0]!.caseIds).toEqual(["1", "2"]);
  });
});
