"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { t, type MessageKey } from "@/lib/i18n";

type Step = "phone" | "code";

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/otp", {
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
      const res = await signIn("otp", { phone, code, redirect: false });
      if (res?.error) {
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

  return (
    <form onSubmit={step === "phone" ? requestOtp : verify} className="space-y-4">
      {step === "phone" ? (
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">
            {t("auth.login.phoneLabel")}
          </span>
          <input
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("auth.login.phonePlaceholder")}
            className="w-full rounded-xl border border-line bg-parch px-4 py-3 text-center focus:bg-white focus:outline focus:outline-2 focus:outline-gold"
          />
        </label>
      ) : (
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">
            {t("auth.login.otpLabel")}
          </span>
          <p className="mb-2 text-xs text-ink-soft">
            {t("auth.login.sentTo")} <span dir="ltr">{phone}</span>
          </p>
          <input
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder={t("auth.login.otpPlaceholder")}
            className="w-full rounded-xl border border-line bg-parch px-4 py-3 text-center text-2xl tracking-[0.4em] focus:bg-white focus:outline focus:outline-2 focus:outline-gold"
          />
        </label>
      )}

      {error && <p className="text-sm text-advocate">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center rounded-xl bg-bench px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {busy
          ? t("common.loading")
          : step === "phone"
            ? t("auth.login.sendOtp")
            : t("auth.login.verify")}
      </button>

      {step === "code" && (
        <button
          type="button"
          onClick={() => {
            setStep("phone");
            setCode("");
            setError(null);
          }}
          className="w-full text-center text-sm text-ink-soft underline"
        >
          {t("auth.login.resend")}
        </button>
      )}
    </form>
  );
}
