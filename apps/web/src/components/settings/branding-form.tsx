"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { officesUpdateBranding, type OfficeBranding } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { apiErrorKey } from "@/lib/api-error";
import { browserApi } from "@/lib/browser-api";

type Field = {
  name: keyof OfficeBranding;
  label: MessageKey;
  type?: "color";
  ltr?: boolean;
  minWidth: number;
  grow?: boolean;
};

const FIELDS: Field[] = [
  { name: "name", label: "settings.office.name", minWidth: 220, grow: true },
  { name: "tagline", label: "settings.office.tagline", minWidth: 220, grow: true },
  { name: "phone", label: "settings.office.phone", ltr: true, minWidth: 180 },
  { name: "email", label: "settings.office.email", ltr: true, minWidth: 220 },
  { name: "website", label: "settings.office.website", ltr: true, minWidth: 180 },
  { name: "address", label: "settings.office.address", minWidth: 220, grow: true },
  { name: "licenseNo", label: "settings.office.licenseNo", minWidth: 200 },
  { name: "primaryColor", label: "settings.office.primaryColor", type: "color", minWidth: 140 },
  { name: "accentColor", label: "settings.office.accentColor", type: "color", minWidth: 140 },
  {
    name: "confidentialityNotice",
    label: "settings.office.confidentialityNotice",
    minWidth: 260,
    grow: true,
  },
];

/** Office letterhead branding (legacy settings → office), partner only. */
export function BrandingForm({ branding }: { branding: OfficeBranding }) {
  const router = useRouter();
  const [values, setValues] = useState(branding);
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      style={{ display: "flex", flexWrap: "wrap", gap: 10 }}
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const res = await officesUpdateBranding({ client: browserApi, body: values });
          if (res.error) {
            setError(apiErrorKey(res.error));
            return;
          }
          router.refresh();
        });
      }}
    >
      {FIELDS.map((f) => (
        <label
          key={f.name}
          className="field"
          style={{ minWidth: f.minWidth, ...(f.grow ? { flex: 1 } : {}) }}
        >
          <span>{t(f.label)}</span>
          <input
            type={f.type ?? "text"}
            dir={f.ltr ? "ltr" : undefined}
            required={f.name === "name"}
            value={values[f.name]}
            onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
          />
        </label>
      ))}
      <div style={{ width: "100%" }}>
        <button type="submit" className="act b-add" disabled={pending}>
          {t("settings.office.save")}
        </button>
        {error && <div className="lerr">{t(error)}</div>}
      </div>
    </form>
  );
}
