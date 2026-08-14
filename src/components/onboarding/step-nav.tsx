"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceAction, finishAction } from "@/app/onboarding/actions";
import { t } from "@/lib/i18n";

/**
 * Step controls: back, skip this step, continue — plus a separate way out.
 *
 * "Skip" used to end the whole wizard. On a per-step control that reading is
 * simply wrong: pressing تخطّي on step 2 means "I do not want to fill this in,
 * take me to step 3", not "abandon setup". It ejected the user to /today with
 * no route back except the settings page, which is how a user gets stuck
 * between steps 2 and 3.
 *
 * So skipping advances, and leaving the wizard is its own quieter control with
 * its own wording. Both are still one click; only the labels now match what
 * they do.
 *
 * Renders exactly ONE .ob-actions row. Callers pass their submit button as
 * children rather than wrapping this in a second row — nesting the two put a
 * flex container inside a flex container and broke the alignment.
 */
export function StepNav({
  back,
  next,
  finish = false,
  children,
}: {
  back?: number;
  next?: number;
  finish?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const go = (step: number) =>
    start(async () => {
      await advanceAction(step);
      router.push(`/onboarding?step=${step}`);
      router.refresh();
    });

  const leave = () =>
    start(async () => {
      await finishAction();
      router.push("/today");
      router.refresh();
    });

  return (
    <div className="ob-actions">
      {/* Leaving setup sits apart from the step controls, so it cannot be
          mistaken for "next". */}
      {!finish && (
        <button type="button" className="ob-later" onClick={leave} disabled={pending}>
          {t("onboarding.later")}
        </button>
      )}
      <span className="ob-actions-spacer" />
      {back !== undefined && (
        <button
          type="button"
          className="ob-btn ghost"
          onClick={() => router.push(`/onboarding?step=${back}`)}
          disabled={pending}
        >
          {t("onboarding.back")}
        </button>
      )}
      {next !== undefined && (
        <button type="button" className="ob-btn ghost" onClick={() => go(next)} disabled={pending}>
          {t("onboarding.skipStep")}
        </button>
      )}
      {children}
      {next !== undefined && !children && (
        <button type="button" className="ob-btn" onClick={() => go(next)} disabled={pending}>
          {pending ? t("common.loading") : t("onboarding.next")}
        </button>
      )}
      {finish && (
        <button type="button" className="ob-btn" onClick={leave} disabled={pending}>
          {pending ? t("common.loading") : t("onboarding.finish")}
        </button>
      )}
    </div>
  );
}
