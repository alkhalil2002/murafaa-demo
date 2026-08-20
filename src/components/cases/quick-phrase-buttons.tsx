"use client";

import { HEARING_REPORT_PHRASES } from "@/lib/hearing-report-phrases";

/**
 * One-click phrase chips for the wizard's "تقرير العميل" textarea — appends
 * (not replaces) so a lawyer can combine a couple of stock phrases with their
 * own wording instead of retyping the common ones every time.
 */
export function QuickPhraseButtons({ targetName }: { targetName: string }) {
  function insert(phrase: string, e: React.MouseEvent<HTMLButtonElement>) {
    const form = e.currentTarget.closest("form");
    const field = form?.elements.namedItem(targetName) as HTMLTextAreaElement | null;
    if (!field) return;
    field.value = field.value.trim() ? `${field.value.trim()}. ${phrase}` : phrase;
    field.focus();
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
      {HEARING_REPORT_PHRASES.map((phrase) => (
        <button key={phrase} type="button" className="chip" style={{ cursor: "pointer" }} onClick={(e) => insert(phrase, e)}>
          + {phrase}
        </button>
      ))}
    </div>
  );
}
