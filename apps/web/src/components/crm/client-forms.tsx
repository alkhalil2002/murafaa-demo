"use client";

import { useState } from "react";
import { crmCreateClient, crmUpdateClient } from "@murafaa/sdk";
import { CLIENT_STATUSES, CLIENT_TYPES } from "@murafaa/rules";
import { t, type MessageKey } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

type ClientType = (typeof CLIENT_TYPES)[number];
type ClientStatus = (typeof CLIENT_STATUSES)[number];

/** New client (legacy clients page form). */
export function ClientCreateForm() {
  const { run, pending, error } = useApiAction();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    vatNumber: "",
    city: "",
    type: "INDIVIDUAL" as ClientType,
  });

  return (
    <div className="panel">
      <form
        className="three"
        style={{ alignItems: "flex-end" }}
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => crmCreateClient({ client: browserApi, body: form }),
            () => setForm({ name: "", phone: "", vatNumber: "", city: "", type: "INDIVIDUAL" }),
          );
        }}
      >
        <div className="field">
          <label>{t("clients.new")}</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("clients.name")}
            required
          />
        </div>
        <div className="field">
          <label>{t("clients.phone")}</label>
          <input
            type="text"
            dir="ltr"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="field">
          <label>{t("clients.vatNumber")}</label>
          <input
            type="text"
            dir="ltr"
            inputMode="numeric"
            value={form.vatNumber}
            onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
          />
        </div>
        <div className="field">
          <label>{t("clients.city")}</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </div>
        <div className="field">
          <label>{t("clients.type")}</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as ClientType })}
          >
            {CLIENT_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`clientType.${ty}` as MessageKey)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="act b-add" disabled={pending}>
          {t("clients.addSubmit")}
        </button>
      </form>
      {error && <div className="lerr">{t(error)}</div>}
    </div>
  );
}

/** Inline edit under a client card (legacy <details> form). */
export function ClientEditForm({
  client,
}: {
  client: {
    id: string;
    name: string;
    phone: string | null;
    vatNumber: string | null;
    city: string | null;
    status: ClientStatus;
  };
}) {
  const { run, pending, error } = useApiAction();
  const [form, setForm] = useState({
    name: client.name,
    phone: client.phone ?? "",
    vatNumber: client.vatNumber ?? "",
    city: client.city ?? "",
    status: client.status,
  });

  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{ cursor: "pointer", fontSize: 14.375, color: "var(--bench)" }}>
        {t("clients.edit")}
      </summary>
      <form
        style={{ marginTop: 8, display: "grid", gap: 6 }}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => crmUpdateClient({ client: browserApi, path: { id: client.id }, body: form }));
        }}
      >
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={t("clients.name")}
          required
        />
        <input
          type="text"
          dir="ltr"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder={t("clients.phone")}
        />
        <input
          type="text"
          dir="ltr"
          inputMode="numeric"
          value={form.vatNumber}
          onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
          placeholder={t("clients.vatNumber")}
        />
        <input
          type="text"
          value={form.city}
          onChange={(e) => setForm({ ...form, city: e.target.value })}
          placeholder={t("clients.city")}
        />
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as ClientStatus })}
        >
          {CLIENT_STATUSES.map((st) => (
            <option key={st} value={st}>
              {t(`clientStatus.${st}` as MessageKey)}
            </option>
          ))}
        </select>
        <button type="submit" className="tinybtn" disabled={pending}>
          {t("clients.save")}
        </button>
        {error && <div className="lerr">{t(error)}</div>}
      </form>
    </details>
  );
}
