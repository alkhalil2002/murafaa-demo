"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { securityBegin, securityConfirm, securityDisable } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { apiErrorKey } from "@/lib/api-error";
import { browserApi } from "@/lib/browser-api";

/**
 * Two-factor authentication (legacy /account/security): shows a fresh secret
 * and otpauth URI to add to an authenticator app, confirmed by one code.
 * Turning it off needs a current code.
 */
export function TotpPanel({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (enabled) return;
    let cancelled = false;
    void securityBegin({ client: browserApi }).then((res) => {
      if (cancelled) return;
      if (res.data) setEnrollment(res.data.data);
      else setError(apiErrorKey(res.error));
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const submit = (action: typeof securityConfirm) =>
    startTransition(async () => {
      setError(null);
      const res = await action({ client: browserApi, body: { code } });
      if (res.error) {
        setError(apiErrorKey(res.error));
        return;
      }
      setCode("");
      router.refresh();
    });

  const codeInput = (
    <input
      type="text"
      dir="ltr"
      inputMode="numeric"
      maxLength={6}
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
      placeholder={t("auth.login.totpPlaceholder")}
      required
      style={{ flex: 1 }}
    />
  );

  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{t("security.totp.title")}</h2>
      {enabled ? (
        <>
          <div className="sub">{t("security.totp.enabled")}</div>
          <div className="sub">{t("security.totp.disableHint")}</div>
          <form
            style={{ marginTop: 12, display: "flex", gap: 8 }}
            onSubmit={(e) => {
              e.preventDefault();
              submit(securityDisable);
            }}
          >
            {codeInput}
            <button type="submit" className="tinybtn del" disabled={pending}>
              {t("security.totp.disable")}
            </button>
          </form>
        </>
      ) : (
        <>
          <div className="sub">{t("security.totp.hint")}</div>
          {enrollment && (
            <>
              <div className="field">
                <label>{t("security.totp.secretLabel")}</label>
                <input
                  type="text"
                  readOnly
                  dir="ltr"
                  value={enrollment.secret}
                  style={{ fontFamily: "monospace" }}
                />
              </div>
              <div className="sub" dir="ltr" style={{ fontSize: 15.625, wordBreak: "break-all" }}>
                {enrollment.uri}
              </div>
              <form
                style={{ marginTop: 12, display: "flex", gap: 8 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(securityConfirm);
                }}
              >
                {codeInput}
                <button type="submit" className="act b-add" disabled={pending}>
                  {t("security.totp.confirm")}
                </button>
              </form>
            </>
          )}
        </>
      )}
      {error && <div className="lerr">{t(error)}</div>}
    </div>
  );
}
