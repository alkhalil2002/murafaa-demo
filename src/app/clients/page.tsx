import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { listClients } from "@/server/clients";
import { PermissionError } from "@/lib/permissions/guard";
import { clientStatusLabel, clientTypeLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";

export default async function ClientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const clients = await listClients(session);
    content =
      clients.length === 0 ? (
        <p className="text-ink-soft">{t("clients.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="p-3 font-medium">{t("clients.name")}</th>
                <th className="p-3 font-medium">{t("clients.type")}</th>
                <th className="p-3 font-medium">{t("clients.city")}</th>
                <th className="p-3 font-medium">{t("clients.status")}</th>
                <th className="p-3 font-medium">{t("cases.title")}</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-parch-line last:border-0 hover:bg-parch">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 text-ink-soft">{clientTypeLabel(c.type)}</td>
                  <td className="p-3 text-ink-soft">{c.city ?? "—"}</td>
                  <td className="p-3">{clientStatusLabel(c.status)}</td>
                  <td className="p-3 text-ink-soft">{t("clients.casesCount", { n: c._count.cases })}</td>
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
      <h1 className="mb-6 font-serif text-3xl text-bench">{t("clients.title")}</h1>
      {content}
    </AppShell>
  );
}
