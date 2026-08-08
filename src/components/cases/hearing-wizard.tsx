"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

const STEP_LABELS = [
  "cases.hearings.wz.step1",
  "cases.hearings.wz.step2",
  "cases.hearings.wz.step3",
  "cases.hearings.wz.step4",
] as const;

/**
 * 4-step recording wizard chrome (prototype WZ_STEPS/wzStepper), wrapping the
 * real record-hearing form fields. Purely a client-side reveal — every
 * field stays mounted so the single server-action submit on the final step
 * still collects the whole form; no extra round trips per step.
 */
export function HearingWizard({
  step1,
  step2,
  step3,
  step4,
  submitLabel,
}: {
  step1: React.ReactNode;
  step2: React.ReactNode;
  step3: React.ReactNode;
  step4: React.ReactNode;
  submitLabel: string;
}) {
  const [step, setStep] = useState(1);
  const steps = [step1, step2, step3, step4];

  return (
    <>
      <div className="wzstepper">
        {STEP_LABELS.map((key, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "cur" : "";
          return (
            <div key={key} className="wzstep-wrap" style={{ display: "contents" }}>
              {i > 0 && <span className="wzsep">›</span>}
              <button type="button" className={`wzstep ${state}`} onClick={() => setStep(n)}>
                {n < step ? "✓" : n.toLocaleString("ar-SA")} · {t(key as never)}
              </button>
            </div>
          );
        })}
      </div>

      {steps.map((content, i) => (
        <div key={i} style={{ display: step === i + 1 ? "block" : "none" }}>
          {content}
        </div>
      ))}

      <div className="actions">
        {step > 1 && (
          <button type="button" className="tinybtn" onClick={() => setStep((s) => s - 1)}>
            {t("cases.hearings.wz.back" as never)}
          </button>
        )}
        {step < 4 ? (
          <button type="button" className="act b-add" onClick={() => setStep((s) => s + 1)}>
            {t("cases.hearings.wz.next" as never)}
          </button>
        ) : (
          <button type="submit" className="act b-add">
            {submitLabel}
          </button>
        )}
      </div>
    </>
  );
}
