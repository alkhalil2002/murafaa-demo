"use client";

import { useState } from "react";
import { appointmentsCancel, appointmentsCreate } from "@murafaa/sdk";
import { APPOINTMENT_TYPES } from "@murafaa/rules";
import { t, type MessageKey } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

function ErrorLine({ error }: { error: MessageKey | null }) {
  return error ? <div className="lerr">{t(error)}</div> : null;
}

/** Book an appointment, optionally with an existing client. */
export function AppointmentCreateForm({
  clients,
}: {
  clients: Array<{ id: string; name: string }>;
}) {
  const { run, pending, error } = useApiAction();
  const [formKey, setFormKey] = useState(0);
  const val = (fd: FormData, k: string) => {
    const v = fd.get(k);
    return typeof v === "string" && v ? v : null;
  };
  return (
    <div className="panel">
      <form
        key={formKey}
        className="three"
        style={{ alignItems: "flex-end" }}
        action={(fd) => {
          const clientId = val(fd, "clientId");
          const contact =
            val(fd, "contactName") ?? clients.find((c) => c.id === clientId)?.name ?? "";
          run(
            () =>
              appointmentsCreate({
                client: browserApi,
                body: {
                  contactName: contact,
                  clientId,
                  scheduledOn: val(fd, "scheduledOn") ?? "",
                  scheduledTime: val(fd, "scheduledTime"),
                  type: (val(fd, "type") ??
                    "FIRST_CONSULTATION") as (typeof APPOINTMENT_TYPES)[number],
                },
              }),
            () => setFormKey((k) => k + 1),
          );
        }}
      >
        <div className="field">
          <label>{t("appts.contact")}</label>
          <input type="text" name="contactName" />
        </div>
        <div className="field">
          <label>{t("cases.client")}</label>
          <select name="clientId" defaultValue="">
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t("appts.type")}</label>
          <select name="type" defaultValue="FIRST_CONSULTATION">
            {APPOINTMENT_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`apptType.${ty}` as MessageKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t("appts.date")}</label>
          <input type="date" name="scheduledOn" required />
        </div>
        <div className="field">
          <label>{t("appts.time")}</label>
          <input type="time" name="scheduledTime" />
        </div>
        <button type="submit" className="act b-add" disabled={pending}>
          {t("appts.addSubmit")}
        </button>
      </form>
      <ErrorLine error={error} />
    </div>
  );
}

export function CancelAppointmentButton({ id }: { id: string }) {
  const { run, pending, error } = useApiAction();
  return (
    <>
      <button
        type="button"
        className="tinybtn del"
        disabled={pending}
        onClick={() => run(() => appointmentsCancel({ client: browserApi, path: { id } }))}
      >
        {t("appts.cancel")}
      </button>
      <ErrorLine error={error} />
    </>
  );
}
