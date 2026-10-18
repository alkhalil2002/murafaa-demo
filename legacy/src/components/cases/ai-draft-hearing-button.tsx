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
    setStatus("done");
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button type="button" className="tinybtn" onClick={handleClick} disabled={status === "loading"}>
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
        </div>
      )}
    </div>
  );
}
