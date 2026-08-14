"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { saveIdentityAction, type StepState } from "@/app/onboarding/actions";
import { StepNav } from "./step-nav";
import { t } from "@/lib/i18n";

/** Office name + tagline. Full branding (colours, licence, logo) lives in settings. */
export function IdentityStep({ officeName }: { officeName: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<StepState, FormData>(
    async (prev, form) => {
      const res = await saveIdentityAction(prev, form);
      if (res.ok) router.push("/onboarding?step=2");
      return res;
    },
    {},
  );

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="ob-name">{t("signup.officeName")}</label>
        <input id="ob-name" name="name" defaultValue={officeName} required maxLength={120} />
      </div>
      <div className="field">
        <label htmlFor="ob-tag">{t("onboarding.identity.tagline")}</label>
        <input id="ob-tag" name="tagline" maxLength={160} />
      </div>
      <StepNav back={0} next={2}>
        <button type="submit" className="ob-btn" disabled={pending}>
          {pending ? t("common.loading") : t("onboarding.next")}
        </button>
      </StepNav>
      {state.error && <div className="lerr">{t("signup.error.validation")}</div>}
    </form>
  );
}
