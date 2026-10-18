"use client";

import { useState } from "react";
import { officesUpdateTaxProfile, type OfficeTaxProfile } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

/** The ZATCA tax profile (partner only; the API enforces it). */
export function TaxProfileForm({ profile }: { profile: OfficeTaxProfile }) {
  const { run, pending, error } = useApiAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}
      action={(fd) => {
        setSaved(false);
        const v = (k: string) => String(fd.get(k) ?? "").trim() || null;
        run(
          () =>
            officesUpdateTaxProfile({
              client: browserApi,
              body: {
                vatNumber: v("vatNumber"),
                crNumber: v("crNumber"),
                taxAddress: v("taxAddress"),
              },
            }),
          () => setSaved(true),
        );
      }}
    >
      <label className="field" style={{ minWidth: 200 }}>
        <span>{t("settings.tax.vatNumber")}</span>
        <input
          type="text"
          name="vatNumber"
          dir="ltr"
          inputMode="numeric"
          defaultValue={profile.vatNumber ?? ""}
        />
      </label>
      <label className="field" style={{ minWidth: 180 }}>
        <span>{t("settings.tax.crNumber")}</span>
        <input
          type="text"
          name="crNumber"
          dir="ltr"
          inputMode="numeric"
          defaultValue={profile.crNumber ?? ""}
        />
      </label>
      <label className="field" style={{ minWidth: 260, flex: 1 }}>
        <span>{t("settings.tax.address")}</span>
        <input type="text" name="taxAddress" defaultValue={profile.taxAddress ?? ""} />
      </label>
      <button type="submit" className="act b-add" disabled={pending}>
        {t("settings.tax.save")}
      </button>
      {saved && !error && (
        <span className="sub" style={{ color: "var(--ok)" }}>
          {t("settings.tax.saved")}
        </span>
      )}
      {error && <div className="lerr">{t(error)}</div>}
    </form>
  );
}
