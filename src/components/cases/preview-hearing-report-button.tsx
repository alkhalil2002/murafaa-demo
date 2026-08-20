"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

/**
 * "⬇ معاينة PDF بالديباجة" (wizard step 4) — previews the in-progress
 * (unsaved) client-report text as a letterhead PDF, nothing persisted.
 *
 * Cannot be a plain `formAction`/`formTarget="_blank"` submit button: the
 * wizard's `<form action={recordHearingAction}>` has a function action, and
 * React silently strips any `method`/`encType` override on a sibling
 * `formAction` button in that case (it always resubmits as a plain GET),
 * which 405s against this preview route and would also leak the full report
 * text into the request URL. Fetching client-side sidesteps both.
 *
 * `window.open` only survives popup blockers when called synchronously from
 * the click handler, so a blank tab is opened first and redirected to the
 * blob URL once the PDF response arrives.
 */
export function PreviewHearingReportButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.closest("form");
    if (!form) return;
    const caseId = (form.elements.namedItem("caseId") as HTMLInputElement | null)?.value ?? "";
    const clientReport = (form.elements.namedItem("clientReport") as HTMLTextAreaElement | null)?.value ?? "";

    const preview = window.open("about:blank", "_blank");
    setStatus("loading");
    try {
      const body = new FormData();
      body.set("caseId", caseId);
      body.set("clientReport", clientReport);
      const res = await fetch("/api/hearings/preview-report-pdf", { method: "POST", body });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (preview) {
        // Revoke once the preview tab has actually loaded the blob (or after
        // a generous fallback, in case the PDF viewer never fires `load`) —
        // otherwise every preview click pins another rendered PDF in memory
        // for the rest of the session.
        preview.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        preview.location.href = url;
      } else {
        URL.revokeObjectURL(url);
      }
      setStatus("idle");
    } catch {
      preview?.close();
      setStatus("error");
    }
  }

  return (
    <div style={{ display: "inline-block" }}>
      <button type="button" className="tinybtn" style={{ marginTop: 6 }} onClick={handleClick} disabled={status === "loading"}>
        {status === "loading" ? t("cases.hearings.previewDraftPdfLoading") : t("cases.hearings.previewDraftPdf")}
      </button>
      {status === "error" && (
        <div className="sub" style={{ marginTop: 4 }}>
          {t("cases.hearings.previewDraftPdfError")}
        </div>
      )}
    </div>
  );
}
