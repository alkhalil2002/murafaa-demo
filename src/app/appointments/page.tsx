import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { listAppointments } from "@/server/appointments";
import { PermissionError } from "@/lib/permissions/guard";
import { apptTypeLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";

export default async function AppointmentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  let total = 0;
  try {
    const appts = await listAppointments(session);
    total = appts.length;
    content = (
      <div className="panel">
        {appts.length === 0 ? (
          <div className="sub" style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            {t("appts.empty")}
          </div>
        ) : (
          appts.map((a) => (
            <div className="approve-row" key={a.id}>
              <span className="ndot" style={{ background: "var(--bench)" }} />
              <span className="at">
                {a.contactName}
                <span className="chip"> {apptTypeLabel(a.type)}</span>
              </span>
              <span className="chip">
                {new Date(a.scheduledOn).toISOString().slice(0, 10)}
                {a.scheduledTime ? ` · ${a.scheduledTime}` : ""}
              </span>
            </div>
          ))
        )}
      </div>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("appts.title")}</h2>
        <span className="pill">{t("appts.pill", { n: total.toLocaleString("ar-SA") })}</span>
      </div>
      {content}
    </AppShell>
  );
}
