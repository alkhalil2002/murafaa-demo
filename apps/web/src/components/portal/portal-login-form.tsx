"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  clientPortalRequestOtp,
  clientPortalVerify,
  employeePortalRequestOtp,
  employeePortalVerify,
} from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { IconWhatsapp } from "@/components/icons";
import { apiErrorKey } from "@/lib/api-error";
import { browserApi } from "@/lib/browser-api";

const FLOW = {
  CLIENT: { otp: clientPortalRequestOtp, verify: clientPortalVerify, home: "/portal" },
  EMPLOYEE: { otp: employeePortalRequestOtp, verify: employeePortalVerify, home: "/emp-portal" },
} as const;

/** Portal sign-in (legacy portal-login-form / emp-portal-login-form): phone → WhatsApp code. */
export function PortalLoginForm({ kind }: { kind: keyof typeof FLOW }) {
  const flow = FLOW[kind];
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devMode, setDevMode] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await flow.otp({ client: browserApi, body: { phone, channel: "whatsapp" } });
      if (res.error) return setError(apiErrorKey(res.error));
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
      const res = await flow.verify({ client: browserApi, body: { phone, code } });
      if (res.error) return setError(apiErrorKey(res.error));
      router.replace(flow.home);
      router.refresh();
    } catch {
      setError("auth.error.generic");
    } finally {
      setBusy(false);
    }
  }

  if (step === "phone")
    return (
      <form onSubmit={send}>
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
      {error && <div className="lerr">{t(error)}</div>}
    </form>
  );
}
