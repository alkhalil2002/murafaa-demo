"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { crmConvert, crmCreateLead, crmDeleteLead, crmMoveLead, crmUpdateLead } from "@murafaa/sdk";
import { halalasToRiyals, riyalsToHalalas } from "@murafaa/rules";
import { t, type MessageKey } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

/** The sources legacy's form offered (the prototype's list). */
const FORM_SOURCES = ["WEBSITE", "REFERRAL", "WHATSAPP", "EXHIBITION", "OTHER"] as const;

/** Riyal text from a number input → integer halalas (money is never a float). */
const toHalalas = (riyals: string) => (riyals.trim() ? riyalsToHalalas(Number(riyals)) : 0);

/** New lead (legacy leads page form). */
export function LeadCreateForm() {
  const { run, pending, error } = useApiAction();
  const empty = {
    name: "",
    source: "" as "" | (typeof FORM_SOURCES)[number],
    value: "",
    phone: "",
    nextAction: "",
  };
  const [form, setForm] = useState(empty);

  return (
    <div className="panel">
      <form
        className="three"
        style={{ alignItems: "flex-end" }}
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              crmCreateLead({
                client: browserApi,
                body: {
                  name: form.name,
                  ...(form.source ? { source: form.source } : {}),
                  expectedValue: toHalalas(form.value),
                  phone: form.phone,
                  nextAction: form.nextAction,
                },
              }),
            () => setForm(empty),
          );
        }}
      >
        <div className="field">
          <label>{t("leads.new")}</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("leads.namePlaceholder")}
            required
          />
        </div>
        <div className="field">
          <label>{t("leads.source")}</label>
          <select
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value as typeof form.source })}
          >
            <option value="">—</option>
            {FORM_SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`leadSource.${s}` as MessageKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t("leads.expectedValue")}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
          />
        </div>
        <div className="field">
          <label>{t("leads.phonePlaceholder")}</label>
          <input
            type="text"
            dir="ltr"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder={t("leads.phonePlaceholder")}
          />
        </div>
        <div className="field">
          <label>{t("leads.nextAction")}</label>
          <input
            type="text"
            value={form.nextAction}
            onChange={(e) => setForm({ ...form, nextAction: e.target.value })}
          />
        </div>
        <button type="submit" className="act b-add" disabled={pending}>
          {t("leads.addSubmit")}
        </button>
      </form>
      {error && <div className="lerr">{t(error)}</div>}
    </div>
  );
}

/** Back / advance buttons on a pipeline card; at the last stage, convert into a client and a case (legacy). */
export function LeadMoveControls({
  id,
  canBack,
  canAdvance,
}: {
  id: string;
  canBack: boolean;
  canAdvance: boolean;
}) {
  const router = useRouter();
  const { run, pending, error } = useApiAction();
  const move = (direction: 1 | -1) =>
    run(() => crmMoveLead({ client: browserApi, path: { id }, body: { direction } }));
  const convert = () =>
    run(async () => {
      const res = await crmConvert({ client: browserApi, path: { id } });
      if (res.data) router.push(`/cases/${res.data.data.caseId}`);
      return res;
    });
  return (
    <div className="lctrl">
      {canBack && (
        <button type="button" disabled={pending} onClick={() => move(-1)}>
          {t("leads.back")}
        </button>
      )}
      {canAdvance ? (
        <button type="button" className="fwd" disabled={pending} onClick={() => move(1)}>
          {t("leads.advance")}
        </button>
      ) : (
        <button type="button" className="conv" disabled={pending} onClick={convert}>
          {t("leads.convert")}
        </button>
      )}
      {error && <div className="lerr">{t(error)}</div>}
    </div>
  );
}

/** Inline edit + delete under a pipeline card (legacy <details>). */
export function LeadEditForm({
  lead,
  canDelete,
}: {
  lead: {
    id: string;
    name: string;
    phone: string | null;
    expectedValue: number;
    nextAction: string | null;
  };
  canDelete: boolean;
}) {
  const { run, pending, error } = useApiAction();
  const [form, setForm] = useState({
    name: lead.name,
    phone: lead.phone ?? "",
    value: lead.expectedValue > 0 ? String(halalasToRiyals(lead.expectedValue)) : "",
    nextAction: lead.nextAction ?? "",
  });

  return (
    <details style={{ marginTop: 6 }}>
      <summary style={{ cursor: "pointer", fontSize: 14.375, color: "var(--bench)" }}>
        {t("leads.edit")}
      </summary>
      <form
        style={{ marginTop: 6, display: "grid", gap: 4 }}
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            crmUpdateLead({
              client: browserApi,
              path: { id: lead.id },
              body: {
                name: form.name,
                phone: form.phone,
                expectedValue: toHalalas(form.value),
                nextAction: form.nextAction,
              },
            }),
          );
        }}
      >
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={t("leads.namePlaceholder")}
          required
        />
        <input
          type="text"
          dir="ltr"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder={t("leads.phonePlaceholder")}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.value}
          onChange={(e) => setForm({ ...form, value: e.target.value })}
        />
        <input
          type="text"
          value={form.nextAction}
          onChange={(e) => setForm({ ...form, nextAction: e.target.value })}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button type="submit" className="tinybtn" disabled={pending}>
            {t("leads.save")}
          </button>
        </div>
      </form>
      {canDelete && (
        <button
          type="button"
          className="tinybtn del"
          style={{ marginTop: 4 }}
          disabled={pending}
          onClick={() => run(() => crmDeleteLead({ client: browserApi, path: { id: lead.id } }))}
        >
          {t("leads.delete")}
        </button>
      )}
      {error && <div className="lerr">{t(error)}</div>}
    </details>
  );
}
