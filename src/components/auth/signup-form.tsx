"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { IconWhatsapp } from "@/components/icons";
import { signupAction, type SignupState } from "@/app/signup/actions";
import { t, type MessageKey } from "@/lib/i18n";

/**
 * Self-serve signup. Two steps, mirroring the login form: office details →
 * phone verification. On success the new PARTNER lands inside their office
 * with the trial already running.
 */

const ERROR_KEY: Record<string, MessageKey> = {
  PHONE_INVALID: "auth.error.phoneInvalid",
  PHONE_TAKEN: "signup.error.phoneTaken",
  VALIDATION: "signup.error.validation",
};

export function SignupForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<SignupState, FormData>(signupAction, {
    step: "form",
  });
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Dev convenience: the console OTP provider returns the code, so prefill it
  // exactly as the login form does. Never populated with a real provider.
  const prefilled = state.step === "verify" ? (state.devCode ?? "") : "";
  const effectiveCode = code || prefilled;

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (state.step !== "verify") return;
    setBusy(true);
    setVerifyError(null);
    try {
      const res = await signIn("otp", {
        phone: state.phone,
        code: effectiveCode,
        redirect: false,
      });
      if (res?.error) {
        setVerifyError(t("auth.otp.invalid"));
        return;
      }
      router.push("/today");
      router.refresh();
    } catch {
      setVerifyError(t("auth.error.generic"));
    } finally {
      setBusy(false);
    }
  }

  if (state.step === "verify") {
    return (
      <form onSubmit={verify}>
        <div className="wabubble">
          <div className="wh">
            <IconWhatsapp />
            {t("auth.login.whatsappBrand")}
          </div>
          {t("auth.login.sentTo")} <span dir="ltr">{state.phone}</span>
        </div>
        {state.devCode && <div className="lhint">{t("auth.login.devAutofilled")}</div>}
        <div className="field">
          <label>{t("auth.login.otpLabel")}</label>
          <input
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={effectiveCode}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <button type="submit" disabled={busy} className="lbtn">
          {busy ? t("common.loading") : t("signup.verifySubmit")}
        </button>
        {verifyError && <div className="lerr">{verifyError}</div>}
      </form>
    );
  }

  return (
    <form action={formAction}>
      <div className="field">
        <label>{t("signup.officeName")}</label>
        <input name="officeName" required maxLength={120} />
      </div>
      <div className="field">
        <label>{t("signup.adminName")}</label>
        <input name="adminName" required maxLength={80} />
      </div>
      <div className="field">
        <label>{t("auth.login.phoneLabel")}</label>
        <div className="phone">
          <span className="cc">+966</span>
          <input
            dir="ltr"
            inputMode="numeric"
            autoComplete="tel"
            name="phone"
            required
            placeholder={t("auth.login.phonePlaceholder")}
          />
        </div>
      </div>
      <button type="submit" disabled={pending} className="lbtn wa">
        <IconWhatsapp />
        {pending ? t("common.loading") : t("signup.submit")}
      </button>
      <div className="lhint">{t("signup.trialHint")}</div>
      {state.step === "form" && state.error && (
        <div className="lerr">{t(ERROR_KEY[state.error] ?? "auth.error.generic")}</div>
      )}
    </form>
  );
}
