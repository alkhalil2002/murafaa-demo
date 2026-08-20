import { describe, expect, it } from "vitest";
import { parseReminderRows, parseTaskRows, parseProcedureRequestRows } from "@/lib/forms/repeatable-rows";

function fd(entries: [string, string][]): FormData {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe("parseReminderRows", () => {
  it("zips multiple rows positionally", () => {
    const f = fd([
      ["reminders[].text", "تذكير 1"],
      ["reminders[].dueOn", "2026-09-01"],
      ["reminders[].text", "تذكير 2"],
      ["reminders[].dueOn", "2026-09-05"],
    ]);
    const rows = parseReminderRows(f);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.text).toBe("تذكير 1");
    expect(rows[1]?.text).toBe("تذكير 2");
    expect(rows[1]?.dueOn?.toISOString().slice(0, 10)).toBe("2026-09-05");
  });

  it("drops blank rows and works with zero rows", () => {
    expect(parseReminderRows(fd([]))).toEqual([]);
    const f = fd([
      ["reminders[].text", "  "],
      ["reminders[].dueOn", ""],
    ]);
    expect(parseReminderRows(f)).toEqual([]);
  });

  it("defaults a missing dueOn to null (record path falls back to the hearing date)", () => {
    const f = fd([["reminders[].text", "تذكير"]]);
    expect(parseReminderRows(f)).toEqual([{ text: "تذكير", dueOn: null }]);
  });
});

describe("parseTaskRows", () => {
  it("zips title/assignee/dueAt and drops blank titles", () => {
    const f = fd([
      ["tasks[].title", "مهمة 1"],
      ["tasks[].assigneeId", ""],
      ["tasks[].dueAt", "2026-09-01"],
      ["tasks[].title", ""],
      ["tasks[].assigneeId", ""],
      ["tasks[].dueAt", ""],
    ]);
    const rows = parseTaskRows(f);
    expect(rows).toEqual([{ title: "مهمة 1", assigneeId: null, dueAt: new Date("2026-09-01") }]);
  });
});

describe("parseProcedureRequestRows", () => {
  it("rejects an unrecognized party/type instead of throwing", () => {
    const f = fd([
      ["procedureRequests[].party", "NOT_A_PARTY"],
      ["procedureRequests[].type", "NOT_A_TYPE"],
      ["procedureRequests[].text", "طلب ندب خبير"],
    ]);
    const rows = parseProcedureRequestRows(f);
    expect(rows).toEqual([{ text: "طلب ندب خبير", party: null, type: null }]);
  });
});
