"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authRequestOtp, authVerify } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { IconWhatsapp } from "@/components/icons";
import { browserApi } from "@/lib/browser-api";

type Step = "phone" | "code";
type ApiErrorBody = {
  error?: { code?: string; messageKey?: string; details?: Array<{ message: string }> };
};

/** The i18n key to show for an API error envelope (field message first, then the code's message). */
function errorKey(body: unknown): MessageKey {
  const error = (body as ApiErrorBody | undefined)?.error;
  return (error?.details?.[0]?.message ?? error?.messageKey ?? "auth.error.generic") as MessageKey;
}

/** OTP login (legacy login-form): phone → WhatsApp code → optional TOTP. */
export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await authRequestOtp({
        client: browserApi,
        body: { phone, channel: "whatsapp" },
      });
      if (res.error) {
        setError(errorKey(res.error));
        return;
      }
      const devCode = res.data?.data.devCode;
      if (devCode) {
        setCode(devCode);
        setDevMode(true);
      }
      setStep("code");
    } catch {
      setError("auth.error.generic");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await authVerify({
        client: browserApi,
        body: { phone, code, ...(needsTotp && totp ? { totp } : {}) },
      });
      if (res.error) {
        // The same OTP stays valid until every check passes, so the user can add the TOTP code and retry.
        if ((res.error as ApiErrorBody).error?.code === "TOTP_REQUIRED") setNeedsTotp(true);
        setError(errorKey(res.error));
        return;
      }
      router.replace("/today");
      router.refresh();
    } catch {
      setError("auth.error.generic");
    } finally {
      setBusy(false);
    }
  }

  if (step === "phone") {
    return (
      <form onSubmit={requestOtp}>
        <div className="field">
          <label>{t("auth.login.phoneLabel")}</label>
          <div className="phone">
            <span className="cc">+966</span>
            <input
              dir="ltr"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("auth.login.phonePlaceholder")}
            />
          </div>
        </div>
        <button type="submit" disabled={busy} className="lbtn wa">
          <IconWhatsapp />
          {busy ? t("common.loading") : t("auth.login.sendOtp")}
        </button>
        <div className="lhint">{t("auth.login.hint")}</div>
        {error && <div className="lerr">{t(error)}</div>}
      </form>
    );
  }

  return (
    <form onSubmit={verify}>
      <div className="wabubble">
        <div className="wh">
          <IconWhatsapp />
          {t("auth.login.whatsappBrand")}
        </div>
        {t("auth.login.sentTo")} <span dir="ltr">{phone}</span>
      </div>
      {devMode && <div className="lhint">{t("auth.login.devAutofilled")}</div>}
      <div className="field">
        <label>{t("auth.login.otpLabel")}</label>
        <input
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          placeholder={t("auth.login.otpPlaceholder")}
          style={{ textAlign: "center", fontSize: 30, letterSpacing: "0.4em" }}
        />
      </div>
      {needsTotp && (
        <div className="field">
          <label>{t("auth.login.totpLabel")}</label>
          <input
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={totp}
            onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
            placeholder={t("auth.login.totpPlaceholder")}
            style={{ textAlign: "center", fontSize: 25, letterSpacing: "0.3em" }}
          />
        </div>
      )}
      <button type="submit" disabled={busy} className="lbtn go">
        {busy ? t("common.loading") : t("auth.login.verify")}
      </button>
      <button
        type="button"
        className="lback"
        onClick={() => {
          setStep("phone");
          setCode("");
          setTotp("");
          setNeedsTotp(false);
          setError(null);
        }}
      >
        {t("auth.login.resend")}
      </button>
      {error && <div className="lerr">{t(error)}</div>}
    </form>
  );
}
