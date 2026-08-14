"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceAction, finishAction } from "@/app/onboarding/actions";
import { t } from "@/lib/i18n";

/**
 * Forward / skip / finish controls.
 *
 * "Skip" and "Finish" both end the wizard, deliberately. An owner who skips is
 * telling us they want to get on with it — dropping them back here on the next
 * login would be nagging, and the settings page can reopen it.
 */
export function StepNav({
  next,
  back,
  finish = false,
}: {
  next?: number;
  back?: number;
  finish?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const go = (step: number) =>
    start(async () => {
      await advanceAction(step);
      router.push(`/onboarding?step=${step}`);
    });

  const end = () =>
    start(async () => {
      await finishAction();
      router.push("/today");
      router.refresh();
    });

  return (
    <div className="ob-actions">
      {back !== undefined && (
        <button type="button" className="ob-btn ghost" onClick={() => router.push(`/onboarding?step=${back}`)}>
          {t("onboarding.back")}
        </button>
      )}
      {!finish && (
        <button type="button" className="ob-btn ghost" onClick={end} disabled={pending}>
          {t("onboarding.skip")}
        </button>
      )}
      {next !== undefined && (
        <button type="button" className="ob-btn" onClick={() => go(next)} disabled={pending}>
          {pending ? t("common.loading") : t("onboarding.next")}
        </button>
      )}
      {finish && (
        <button type="button" className="ob-btn" onClick={end} disabled={pending}>
          {pending ? t("common.loading") : t("onboarding.finish")}
        </button>
      )}
    </div>
  );
}
