"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { draftHearingReportAction } from "@/app/cases/hearing-ai-actions";

/**
 * "✨ صِغ من الملاحظات" (prototype wzGen) — reads the wizard's own raw-notes
 * textarea and writes the AI draft straight into the sibling minutes/result/
 * clientReport fields of the same <form> (all wizard steps stay mounted, see
 * hearing-wizard.tsx), so the lawyer can review/edit before submitting. Pure
 * drafting assistance over the lawyer's own text — never invents facts, and
 * everything it fills stays fully editable.
 */
export function AiDraftHearingButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "unavailable" | "error" | "needsNotes" | "done">("idle");
  const [suggestedNotes, setSuggestedNotes] = useState<string[]>([]);

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.closest("form");
    if (!form) return;
    const notesEl = form.elements.namedItem("minutes") as HTMLTextAreaElement | null;
    const rawNotes = notesEl?.value.trim() ?? "";
    if (!rawNotes) {
      setStatus("needsNotes");
      return;
    }
    setStatus("loading");
    const result = await draftHearingReportAction(rawNotes);
    if (!result.ok) {
      setStatus(result.reason === "unavailable" ? "unavailable" : "error");
      return;
    }
    const minutesEl = form.elements.namedItem("minutes") as HTMLTextAreaElement | null;
    const resultEl = form.elements.namedItem("result") as HTMLInputElement | null;
    const reportEl = form.elements.namedItem("clientReport") as HTMLTextAreaElement | null;
    if (minutesEl) minutesEl.value = result.draft.minutes;
    if (resultEl) resultEl.value = result.draft.result;
    if (reportEl) reportEl.value = result.draft.clientReport;

    const notes: string[] = [];
    if (result.draft.nextHearingDate) {
      const nextDateEl = form.elements.namedItem("nextHearingDate") as HTMLInputElement | null;
      if (nextDateEl) {
        nextDateEl.value = result.draft.nextHearingDate;
        notes.push(t("cases.hearings.aiSuggestedNextDate"));
      }
    }
    const action = result.draft.suggestedAction;
    if (action) {
      // Fills the wizard's first repeatable row for the matching kind
      // (repeatable-action-rows.tsx renders one row by default) — only when
      // that row is still empty, so it never clobbers something the lawyer
      // already typed.
      const fieldName =
        action.kind === "reminder" ? "reminders[].text" : action.kind === "task" ? "tasks[].title" : "procedureRequests[].text";
      const el = form.elements.namedItem(fieldName);
      const target = el instanceof RadioNodeList ? (el[0] as HTMLInputElement) : (el as HTMLInputElement | null);
      if (target && !target.value) target.value = action.text;
      notes.push(t("cases.hearings.aiSuggestedAction"));
    }
    setSuggestedNotes(notes);
    setStatus("done");
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" className="act b-judge" onClick={handleClick} disabled={status === "loading"}>
        {status === "loading" ? t("cases.hearings.aiDraftLoading") : t("cases.hearings.aiDraft")}
      </button>
      {status === "unavailable" && (
        <div className="sub" style={{ marginTop: 4 }}>
          {t("cases.hearings.aiDraftUnavailable")}
        </div>
      )}
      {status === "needsNotes" && (
        <div className="sub" style={{ marginTop: 4 }}>
          {t("cases.hearings.aiDraftNeedsNotes")}
        </div>
      )}
      {status === "error" && (
        <div className="sub" style={{ marginTop: 4 }}>
          {t("cases.hearings.aiDraftError")}
        </div>
      )}
      {status === "done" && (
        <div className="sub" style={{ marginTop: 4, color: "var(--ok)" }}>
          {t("cases.hearings.aiDraftDone")}
          {suggestedNotes.map((note) => (
            <div key={note}>{note}</div>
          ))}
        </div>
      )}
    </div>
  );
}
