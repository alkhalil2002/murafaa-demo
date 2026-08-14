"use client";

import { useActionState } from "react";
import { Role } from "@prisma/client";
import { inviteAction, type StepState } from "@/app/onboarding/actions";
import { StepNav } from "./step-nav";
import { t, type MessageKey } from "@/lib/i18n";

const ROLE_KEY: Record<string, MessageKey> = {
  PARTNER: "role.partner",
  LAWYER: "role.lawyer",
  ASSISTANT: "role.assistant",
  ACCOUNTANT: "role.accountant",
  ADMIN: "role.admin",
  RECEPTION: "role.reception",
};

const ERROR_KEY: Record<string, MessageKey> = {
  PHONE_INVALID: "auth.error.phoneInvalid",
  PHONE_TAKEN: "signup.error.phoneTaken",
  VALIDATION: "signup.error.validation",
};

/**
 * Add colleagues. There is no invitation email or password: the phone IS the
 * identity, so a new user signs in with an OTP exactly as the owner did.
 */
export function TeamStep({ teamCount }: { teamCount: number }) {
  const [state, formAction, pending] = useActionState<StepState, FormData>(inviteAction, {});

  return (
    <>
      <form action={formAction} className="ob-team">
        <div className="field">
          <label htmlFor="ob-mname">{t("signup.adminName")}</label>
          <input id="ob-mname" name="name" required maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="ob-mphone">{t("auth.login.phoneLabel")}</label>
          <div className="phone">
            <span className="cc">+966</span>
            <input id="ob-mphone" name="phone" dir="ltr" inputMode="numeric" required
              placeholder={t("auth.login.phonePlaceholder")} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="ob-mrole">{t("onboarding.team.role")}</label>
          <select id="ob-mrole" name="role" defaultValue={Role.LAWYER}>
            {Object.values(Role).map((r) => (
              <option key={r} value={r}>{t(ROLE_KEY[r] ?? "role.lawyer")}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="ob-btn ghost" disabled={pending}>
          {pending ? t("common.loading") : t("onboarding.team.add")}
        </button>
        {state.error && <div className="lerr">{t(ERROR_KEY[state.error] ?? "auth.error.generic")}</div>}
        {state.ok && <div className="lhint">{t("onboarding.step.team")} — {teamCount}</div>}
      </form>
      <StepNav back={2} next={4} />
    </>
  );
}
