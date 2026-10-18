import { appointmentsList, authCurrent, crmClients } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import {
  AppointmentCreateForm,
  CancelAppointmentButton,
} from "@/components/overview/appointment-forms";
import { serverApi } from "@/lib/api";
import { fmtDate } from "@/lib/dates-ui";

/** المواعيد: office meetings (legacy appointments page, plus booking and cancel). */
export default async function AppointmentsPage() {
  const api = await serverApi();
  const [me, res] = await Promise.all([
    authCurrent({ client: api }),
    appointmentsList({ client: api }),
  ]);
  const appts = res.data?.data;
  const user = me.data?.data;
  const level = user?.modules.APPOINTMENTS;
  const canEdit = (level === "EDIT" || level === "FULL") && !user?.user.previewRole;
  const clients =
    canEdit && user?.modules.CLIENTS !== "NONE"
      ? ((await crmClients({ client: api })).data?.data ?? [])
      : [];

  return (
    <>
      <div className="vhead">
        <h2>{t("appts.title")}</h2>
        <span className="pill">
          {t("appts.pill", { n: (appts?.length ?? 0).toLocaleString("ar-SA") })}
        </span>
      </div>
      {!appts ? (
        <DeniedPanel />
      ) : (
        <>
          {canEdit && (
            <AppointmentCreateForm clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
          )}
          <div className="panel">
            {appts.length === 0 ? (
              <div className="sub" style={{ fontSize: 16.25, color: "var(--ink-soft)" }}>
                {t("appts.empty")}
              </div>
            ) : (
              appts.map((a) => (
                <div className="approve-row" key={a.id}>
                  <span className="ndot" style={{ background: "var(--bench)" }} />
                  <span className="at">
                    {a.contactName}
                    <span className="chip"> {t(`apptType.${a.type}` as MessageKey)}</span>
                  </span>
                  <span className="chip">
                    {fmtDate(a.scheduledOn)}
                    {a.scheduledTime ? ` · ${a.scheduledTime}` : ""}
                  </span>
                  {canEdit && <CancelAppointmentButton id={a.id} />}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}
