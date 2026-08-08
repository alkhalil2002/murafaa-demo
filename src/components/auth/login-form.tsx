"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { IconWhatsapp } from "@/components/icons";
import { t, type MessageKey } from "@/lib/i18n";

type Step = "phone" | "code";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [devMode, setDevMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const [otpRes, totpRes] = await Promise.all([
        fetch("/api/auth/otp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone, channel: "whatsapp" }),
        }),
        fetch("/api/auth/2fa-status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone }),
        }).catch(() => null),
      ]);
      const json = await otpRes.json();
      if (json.error) {
        const key = (json.error.messageKey ?? "auth.error.generic") as MessageKey;
        setError(t(key));
        return;
      }
      if (json.data?.devCode) {
        setCode(json.data.devCode);
        setDevMode(true);
      }
      if (totpRes) {
        const totpJson = await totpRes.json().catch(() => null);
        setNeedsTotp(Boolean(totpJson?.data?.required));
      }
      setStep("code");
    } catch {
      setError(t("auth.error.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await signIn("otp", { phone, code, totp, redirect: false });
      if (res?.error) {
        // A generic failure with 2FA not yet known to be required could mean
        // the account needs a TOTP code — reveal the field and let the user
        // retry with the SAME OTP (it isn't consumed until both check out).
        if (!needsTotp) setNeedsTotp(true);
        setError(t("auth.otp.invalid"));
        return;
      }
      router.push("/today");
      router.refresh();
    } catch {
      setError(t("auth.error.generic"));
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
        {error && <div className="lerr">{error}</div>}
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
          style={{ textAlign: "center", fontSize: 24, letterSpacing: "0.4em" }}
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
            style={{ textAlign: "center", fontSize: 20, letterSpacing: "0.3em" }}
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
          setError(null);
        }}
      >
        {t("auth.login.resend")}
      </button>
      {error && <div className="lerr">{error}</div>}
    </form>
  );
}
