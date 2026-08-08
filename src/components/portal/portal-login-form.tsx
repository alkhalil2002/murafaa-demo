"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconWhatsapp } from "@/components/icons";
import { t, type MessageKey } from "@/lib/i18n";

type Step = "phone" | "code";

export function PortalLoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devMode, setDevMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal-auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, channel: "whatsapp" }),
      });
      const json = await res.json();
      if (json.error) {
        const key = (json.error.messageKey ?? "auth.error.generic") as MessageKey;
        setError(t(key));
        return;
      }
      if (json.data?.devCode) {
        setCode(json.data.devCode);
        setDevMode(true);
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
      const res = await fetch("/api/portal-auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const json = await res.json();
      if (json.error) {
        setError(t("auth.otp.invalid"));
        return;
      }
      router.push("/portal");
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
