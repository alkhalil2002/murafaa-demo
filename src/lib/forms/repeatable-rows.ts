import { DocParty } from "@prisma/client";
import { PROC_REQUEST_TYPES } from "@/server/procedure-requests";

/**
 * Zips repeated same-name FormData fields (one <input name="x[].y"> per row,
 * emitted by src/components/cases/repeatable-action-rows.tsx) back into
 * positional row objects. Pure — no I/O — so the zipping/filtering behavior
 * is unit-testable without a live form or database.
 */

export function parseReminderRows(formData: FormData) {
  const texts = formData.getAll("reminders[].text").map(String);
  const dueOns = formData.getAll("reminders[].dueOn").map(String);
  return texts
    .map((text, i) => ({ text: text.trim(), dueOn: dueOns[i] || "" }))
    .filter((r) => r.text)
    .map((r) => ({ text: r.text, dueOn: r.dueOn ? new Date(r.dueOn) : null }));
}

export function parseTaskRows(formData: FormData) {
  const titles = formData.getAll("tasks[].title").map(String);
  const assignees = formData.getAll("tasks[].assigneeId").map(String);
  const dueAts = formData.getAll("tasks[].dueAt").map(String);
  return titles
    .map((title, i) => ({ title: title.trim(), assigneeId: assignees[i] || "", dueAt: dueAts[i] || "" }))
    .filter((r) => r.title)
    .map((r) => ({ title: r.title, assigneeId: r.assigneeId || null, dueAt: r.dueAt ? new Date(r.dueAt) : null }));
}

export function parseProcedureRequestRows(formData: FormData) {
  const parties = formData.getAll("procedureRequests[].party").map(String);
  const types = formData.getAll("procedureRequests[].type").map(String);
  const texts = formData.getAll("procedureRequests[].text").map(String);
  return texts
    .map((text, i) => ({ text: text.trim(), party: parties[i] || "", type: types[i] || "" }))
    .filter((r) => r.text)
    .map((r) => ({
      text: r.text,
      party: r.party && r.party in DocParty ? (r.party as DocParty) : null,
      type: (PROC_REQUEST_TYPES as readonly string[]).includes(r.type)
        ? (r.type as (typeof PROC_REQUEST_TYPES)[number])
        : null,
    }));
}
