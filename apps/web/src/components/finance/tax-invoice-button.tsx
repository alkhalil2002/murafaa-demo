"use client";

import { useState } from "react";
import { t, type MessageKey } from "@murafaa/i18n";
import { apiErrorKey } from "@/lib/api-error";

/**
 * Opens the ZATCA tax invoice PDF. Fetched first so a refusal (no office VAT
 * number, PDF service down) shows its message instead of a raw error page.
 */
export function TaxInvoicePdfButton({ invoiceId }: { invoiceId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  return (
    <>
      <button
        type="button"
        className="tinybtn"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const res = await fetch(`/api/v1/finance/invoices/${invoiceId}/pdf`, {
              credentials: "same-origin",
            });
            if (!res.ok) return setError(apiErrorKey(await res.json().catch(() => null)));
            window.open(URL.createObjectURL(await res.blob()), "_blank");
          } finally {
            setPending(false);
          }
        }}
      >
        {t("finance.taxInvoicePdf")}
      </button>
      {error && <div className="lerr">{t(error)}</div>}
    </>
  );
}
