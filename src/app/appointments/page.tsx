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
  try {
    const appts = await listAppointments(session);
    content =
      appts.length === 0 ? (
        <p className="text-ink-soft">{t("appts.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="p-3 font-medium">{t("appts.contact")}</th>
                <th className="p-3 font-medium">{t("appts.type")}</th>
                <th className="p-3 font-medium">{t("appts.date")}</th>
                <th className="p-3 font-medium">{t("appts.time")}</th>
              </tr>
            </thead>
            <tbody>
              {appts.map((a) => (
                <tr key={a.id} className="border-b border-parch-line last:border-0">
                  <td className="p-3 font-medium">{a.contactName}</td>
                  <td className="p-3 text-ink-soft">{apptTypeLabel(a.type)}</td>
                  <td className="p-3 text-ink-soft">
                    {new Date(a.scheduledOn).toISOString().slice(0, 10)}
                  </td>
                  <td className="p-3 text-ink-soft">{a.scheduledTime ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <h1 className="mb-6 font-serif text-3xl text-bench">{t("appts.title")}</h1>
      {content}
    </AppShell>
  );
}
