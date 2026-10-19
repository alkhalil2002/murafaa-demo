"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { platformActivateConfirm, platformActivateOtp, platformActivateVerify } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { IconWhatsapp } from "@/components/icons";
import { apiErrorKey } from "@/lib/api-error";
import { browserApi } from "@/lib/browser-api";

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);
const codeStyle = { textAlign: "center", fontSize: 30, letterSpacing: "0.4em" } as const;

/**
 * تفعيل حساب إدارة المنصة from a one-time link: WhatsApp code to the invited
 * phone → the authenticator QR, shown only here → its first code. The token
 * lives in the URL fragment, which never reaches a server log.
 */
export function ActivateForm() {
  const router = useRouter();
  // The fragment exists only in the browser: null while rendering on the server.
  const hash = useSyncExternalStore(
    () => () => {},
    () => window.location.hash.slice(1),
    () => null,
  );
  const token = hash === null ? null : /^[A-Za-z0-9_-]{43}$/.test(hash) ? hash : "";
  const [step, setStep] = useState<"start" | "code" | "scan">("start");
  const [who, setWho] = useState<{ name: string; phone: string } | null>(null);
  const [code, setCode] = useState("");
  const [totp, setTotp] = useState("");
  const [enrol, setEnrol] = useState<{ qrSvg: string; setupKey: string } | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function attempt(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError("auth.error.generic");
    } finally {
      setBusy(false);
    }
  }

  if (token === null) return null;
  if (!token) return <div className="lerr">{t("platform.activate.noToken")}</div>;

  if (step === "start")
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void attempt(async () => {
            const res = await platformActivateOtp({ client: browserApi, body: { token } });
            if (res.error) return setError(apiErrorKey(res.error));
            const d = res.data!.data;
            setWho({ name: d.name, phone: d.phone });
            if (d.devCode) setCode(d.devCode);
            setStep("code");
          });
        }}
      >
        <div className="lhint" style={{ marginTop: 0, marginBottom: 16 }}>
          {t("platform.activate.step1")}
        </div>
        <button type="submit" disabled={busy} className="lbtn wa">
          <IconWhatsapp />
          {busy ? t("common.loading") : t("platform.activate.send")}
        </button>
        {error && <div className="lerr">{t(error)}</div>}
      </form>
    );

  if (step === "code")
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void attempt(async () => {
            const res = await platformActivateVerify({ client: browserApi, body: { token, code } });
            if (res.error) return setError(apiErrorKey(res.error));
            setEnrol(res.data!.data);
            setStep("scan");
          });
        }}
      >
        <div className="wabubble">
          <div className="wh">
            <IconWhatsapp />
            {who && t("platform.activate.hello", { name: who.name })}
          </div>
          <span dir="ltr">{who && t("platform.activate.sentTo", { phone: who.phone })}</span>
        </div>
        <div className="field">
          <label>{t("auth.login.otpLabel")}</label>
          <input
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(digits(e.target.value))}
            style={codeStyle}
          />
        </div>
        <button type="submit" disabled={busy || code.length !== 6} className="lbtn">
          {busy ? t("common.loading") : t("platform.activate.next")}
        </button>
        {error && <div className="lerr">{t(error)}</div>}
      </form>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void attempt(async () => {
          const res = await platformActivateConfirm({ client: browserApi, body: { token, totp } });
          if (res.error) return setError(apiErrorKey(res.error));
          router.replace("/platform");
          router.refresh();
        });
      }}
    >
      <div className="lhint" style={{ marginTop: 0 }}>
        {t("platform.activate.scan")}
      </div>
      {enrol && (
        <>
          <div
            style={{ display: "grid", placeItems: "center", margin: "12px 0" }}
            // Our own server-rendered QR (qrSvg: one path, no scripts).
            dangerouslySetInnerHTML={{ __html: enrol.qrSvg }}
          />
          <div className="lhint" style={{ marginTop: 0 }}>
            {t("platform.activate.key")}
            <div
              dir="ltr"
              style={{ fontFamily: "monospace", fontSize: 16, wordBreak: "break-all" }}
            >
              {enrol.setupKey}
            </div>
          </div>
        </>
      )}
      <div className="field">
        <label>{t("platform.activate.firstCode")}</label>
        <input
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={totp}
          onChange={(e) => setTotp(digits(e.target.value))}
          style={codeStyle}
        />
      </div>
      <button type="submit" disabled={busy || totp.length !== 6} className="lbtn">
        {busy ? t("common.loading") : t("platform.activate.finish")}
      </button>
      {error && <div className="lerr">{t(error)}</div>}
    </form>
  );
}
