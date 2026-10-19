"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { platformCreate } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

const STEPS: MessageKey[] = ["platform.new.step1", "platform.new.step2", "platform.new.step3"];

/** إضافة مكتب: office data → the owning partner → trial or active, then create. */
export function NewOfficeWizard() {
  const router = useRouter();
  const { run, pending, error } = useApiAction();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    name: "",
    city: "",
    crNumber: "",
    licenseNumber: "",
    ownerName: "",
    ownerPhone: "",
    status: "TRIAL" as "TRIAL" | "ACTIVE",
    trialEndsAt: "",
    paidUntil: "",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  const ok = [
    f.name.trim().length >= 2,
    f.ownerName.trim().length >= 2 && f.ownerPhone.trim().length > 0,
    f.status === "ACTIVE" || f.trialEndsAt !== "",
  ][step];

  function create() {
    let id = "";
    run(
      async () => {
        const res = await platformCreate({
          client: browserApi,
          body: {
            name: f.name,
            city: f.city || null,
            crNumber: f.crNumber || null,
            licenseNumber: f.licenseNumber || null,
            ownerName: f.ownerName,
            ownerPhone: f.ownerPhone,
            status: f.status,
            trialEndsAt: f.status === "TRIAL" ? f.trialEndsAt : null,
            paidUntil: f.status === "ACTIVE" ? f.paidUntil || null : null,
          },
        });
        id = res.data?.data.id ?? "";
        return res;
      },
      () => router.push(`/platform/offices/${id}`),
    );
  }

  const field = (
    k: keyof typeof f,
    label: MessageKey,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div className="field">
      <label>{t(label)}</label>
      <input className="input" value={f[k]} onChange={set(k)} {...extra} />
    </div>
  );

  return (
    <>
      <Link href="/platform" className="backbtn">
        ‹ {t("platform.nav.offices")}
      </Link>
      <div className="vhead">
        <h2>{t("platform.new.title")}</h2>
        <span className="pill">{t("platform.new.pill")}</span>
      </div>
      <div className="wzstepper">
        {STEPS.map((s, i) => (
          <span key={s} style={{ display: "contents" }}>
            {i > 0 && <span className="wzsep">‹</span>}
            <button
              type="button"
              className={`wzstep${i < step ? " done" : i === step ? " cur" : ""}`}
              onClick={() => i < step && setStep(i)}
            >
              {(i + 1).toLocaleString("ar-SA")} {t(s)}
            </button>
          </span>
        ))}
      </div>
      <div className="panel">
        <h2>
          <span className="n">{(step + 1).toLocaleString("ar-SA")}</span>
          {t(STEPS[step]!)}
        </h2>
        {step === 0 && (
          <div className="two">
            <div className="field">
              <label>
                {t("platform.field.name")}{" "}
                <span className="hint">{t("platform.field.nameHint")}</span>
              </label>
              <input className="input" value={f.name} onChange={set("name")} />
            </div>
            {field("city", "platform.field.city")}
            {field("crNumber", "platform.field.cr", {
              dir: "ltr",
              inputMode: "numeric",
              maxLength: 10,
            })}
            {field("licenseNumber", "platform.field.license", { dir: "ltr" })}
          </div>
        )}
        {step === 1 && (
          <>
            <div className="sub">{t("platform.new.ownerHint")}</div>
            <div className="two">
              {field("ownerName", "platform.field.ownerName")}
              <div className="field">
                <label>{t("platform.field.ownerPhone")}</label>
                <div className="phone">
                  <span className="cc">+966</span>
                  <input
                    className="input"
                    dir="ltr"
                    inputMode="numeric"
                    value={f.ownerPhone}
                    onChange={set("ownerPhone")}
                    placeholder={t("auth.login.phonePlaceholder")}
                  />
                </div>
              </div>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="roles">
              {(["TRIAL", "ACTIVE"] as const).map((s) => (
                <button
                  type="button"
                  key={s}
                  className={`role${f.status === s ? " sel" : ""}`}
                  style={{ textAlign: "start", font: "inherit" }}
                  onClick={() => setF((p) => ({ ...p, status: s }))}
                >
                  <b>{t(s === "TRIAL" ? "platform.new.trial" : "platform.new.active")}</b>
                  <small>
                    {t(s === "TRIAL" ? "platform.new.trialSub" : "platform.new.activeSub")}
                  </small>
                </button>
              ))}
            </div>
            <div className="two" style={{ marginTop: 16 }}>
              {f.status === "TRIAL"
                ? field("trialEndsAt", "platform.field.trialEndsAt", { type: "date" })
                : field("paidUntil", "platform.field.paidUntil", { type: "date" })}
            </div>
            <div className="approve-row">
              <span className="ndot" style={{ background: "var(--status-neutral-dot)" }} />
              <span className="at">{f.name}</span>
              {f.city && <span className="chip">{f.city}</span>}
            </div>
            <div className="approve-row">
              <span className="ndot" style={{ background: "var(--status-neutral-dot)" }} />
              <span className="at">{f.ownerName}</span>
              <span className="chip" dir="ltr">
                {f.ownerPhone}
              </span>
            </div>
            <div className="docnote">{t("platform.new.note")}</div>
          </>
        )}
        <div className="actions">
          {step > 0 && (
            <button type="button" className="mini" onClick={() => setStep(step - 1)}>
              {t("platform.new.prev")}
            </button>
          )}
          {step < 2 ? (
            <button
              type="button"
              className="act b-primary"
              disabled={!ok}
              onClick={() => setStep(step + 1)}
            >
              {t("platform.new.next")}
            </button>
          ) : (
            <button
              type="button"
              className="act b-primary"
              disabled={!ok || pending}
              onClick={create}
            >
              {t("platform.new.create")}
            </button>
          )}
        </div>
        {error && <div className="lerr">{t(error)}</div>}
      </div>
    </>
  );
}
