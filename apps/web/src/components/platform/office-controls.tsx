"use client";

import { useState } from "react";
import { platformUpdate, type PlatformOffice } from "@murafaa/sdk";
import { OFFICE_STATUSES } from "@murafaa/rules";
import { t, type MessageKey } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

type Sub = Pick<PlatformOffice, "id" | "status" | "trialEndsAt" | "paidUntil">;

/** إيقاف المكتب (read-only for everyone in it) or إعادة التفعيل. */
export function OfficeStatusButton({ office }: { office: Sub }) {
  const { run, pending, error } = useApiAction();
  const suspended = office.status === "SUSPENDED";
  return (
    <span style={{ marginInlineStart: "auto", display: "inline-flex", flexDirection: "column" }}>
      <button
        type="button"
        className={`act ${suspended ? "b-primary" : "b-danger"}`}
        disabled={pending}
        onClick={() => {
          if (!suspended && !window.confirm(t("platform.suspend.confirm"))) return;
          run(() =>
            platformUpdate({
              client: browserApi,
              path: { id: office.id },
              body: {
                status: suspended ? "ACTIVE" : "SUSPENDED",
                trialEndsAt: office.trialEndsAt,
                paidUntil: office.paidUntil,
              },
            }),
          );
        }}
      >
        {t(suspended ? "platform.reactivate" : "platform.suspend")}
      </button>
      {error && <span className="lerr">{t(error)}</span>}
    </span>
  );
}

/** Status, trial end and paid-until, recorded by hand (no billing in the system yet). */
export function SubscriptionForm({ office }: { office: Sub }) {
  const { run, pending, error } = useApiAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      action={(fd) => {
        setSaved(false);
        const day = (k: string) => String(fd.get(k) ?? "") || null;
        run(
          () =>
            platformUpdate({
              client: browserApi,
              path: { id: office.id },
              body: {
                status: String(fd.get("status")) as Sub["status"],
                trialEndsAt: day("trialEndsAt"),
                paidUntil: day("paidUntil"),
              },
            }),
          () => setSaved(true),
        );
      }}
    >
      <div className="three">
        <div className="field">
          <label>{t("platform.field.status")}</label>
          <select name="status" defaultValue={office.status} className="input">
            {OFFICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`platform.status.${s}` as MessageKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t("platform.field.trialEndsAt")}</label>
          <input
            type="date"
            name="trialEndsAt"
            defaultValue={office.trialEndsAt ?? ""}
            className="input"
          />
        </div>
        <div className="field">
          <label>{t("platform.field.paidUntil")}</label>
          <input
            type="date"
            name="paidUntil"
            defaultValue={office.paidUntil ?? ""}
            className="input"
          />
        </div>
      </div>
      <div className="actions">
        <button type="submit" className="act b-primary" disabled={pending}>
          {t("common.save")}
        </button>
        {saved && (
          <span className="sub" style={{ margin: 0, alignSelf: "center" }}>
            {t("platform.subs.saved")}
          </span>
        )}
      </div>
      {error && <div className="lerr">{t(error)}</div>}
    </form>
  );
}
