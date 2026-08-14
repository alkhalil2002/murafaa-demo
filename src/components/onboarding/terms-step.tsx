"use client";

import { useActionState, useState } from "react";
import { GLOSSARY, MAX_TERM_LENGTH, type TermId } from "@/lib/i18n/glossary";
import { saveTermsAction, type StepState } from "@/app/onboarding/actions";
import { t } from "@/lib/i18n";
import { StepNav } from "./step-nav";

/**
 * "Name things your way" — the terminology step.
 *
 * The live preview is the point of the screen. Renaming a concept in a form
 * field is abstract; seeing the sidebar you are about to use change under it is
 * not. Without it an owner has to finish the wizard and go hunting to find out
 * what they just did.
 */
export function TermsStep({
  initial,
  defaults,
}: {
  /** The office's current wording, defaults already resolved in. */
  initial: Record<TermId, string>;
  /** Our wording, so "reset" can restore it without a round trip. */
  defaults: Record<TermId, string>;
}) {
  const [state, formAction, pending] = useActionState<StepState, FormData>(saveTermsAction, {});
  const [values, setValues] = useState<Record<string, string>>(initial);

  const set = (id: TermId, v: string) => setValues((p) => ({ ...p, [id]: v }));
  const resetAll = () => setValues({ ...defaults });

  // Only the terms that appear in the sidebar, in nav order.
  const previewIds: TermId[] = ["case", "client", "lead", "task", "document", "invoice"];

  return (
    <form action={formAction} className="ob-terms">
      <div className="ob-terms-list">
        {GLOSSARY.map((def) => {
          const value = values[def.id] ?? "";
          const changed = value !== defaults[def.id];
          return (
            <div className="field ob-term" key={def.id}>
              <label htmlFor={`term-${def.id}`}>
                {defaults[def.id]}
                {changed && <span className="ob-term-badge">{t("onboarding.terms.preview")}</span>}
              </label>
              <input
                id={`term-${def.id}`}
                name={`term.${def.id}`}
                value={value}
                maxLength={MAX_TERM_LENGTH}
                onChange={(e) => set(def.id, e.target.value)}
                // The server treats blank as "keep the default", so an empty
                // field is a valid state, not an error to block submission on.
                placeholder={defaults[def.id]}
              />
              <div className="ob-term-hint">{t(def.hintKey)}</div>
            </div>
          );
        })}
      </div>

      <aside className="ob-preview" aria-live="polite">
        <div className="ob-preview-title">{t("onboarding.terms.preview")}</div>
        <ul className="ob-preview-nav">
          {previewIds.map((id) => (
            <li key={id}>{(values[id] || defaults[id]).trim()}</li>
          ))}
        </ul>
      </aside>

      <StepNav back={1} next={3}>
        <button type="button" className="ob-btn ghost" onClick={resetAll}>
          {t("onboarding.terms.reset")}
        </button>
        <button type="submit" className="ob-btn" disabled={pending}>
          {pending ? t("common.loading") : t("onboarding.next")}
        </button>
      </StepNav>
      {state.error && <div className="lerr">{t("auth.error.generic")}</div>}
    </form>
  );
}
