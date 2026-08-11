"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";

/** Platform-admin sign-in. Phone OTP against PlatformAdmin, never User. */
export function AdminLoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/platform-auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await r.json();
      if (json.error) {
        setError(t("admin.login.failed"));
        return;
      }
      // Dev console provider returns the code; never populated in production.
      if (json.data?.devCode) setCode(json.data.devCode);
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
      const r = await fetch("/api/platform-auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const json = await r.json();
      if (json.error) {
        setError(t("auth.otp.invalid"));
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError(t("auth.error.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={step === "phone" ? request : verify}>
      {step === "phone" ? (
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
            />
          </div>
        </div>
      ) : (
        <div className="field">
          <label>{t("auth.login.otpLabel")}</label>
          <input
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
      )}
      <button type="submit" disabled={busy} className="lbtn">
        {busy
          ? t("common.loading")
          : step === "phone"
            ? t("auth.login.sendOtp")
            : t("signup.verifySubmit")}
      </button>
      {error && <div className="lerr">{error}</div>}
    </form>
  );
}
