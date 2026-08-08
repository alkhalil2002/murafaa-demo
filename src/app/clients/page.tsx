import { redirect } from "next/navigation";
import { ClientStatus } from "@prisma/client";
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
  let total = 0;
  try {
    const clients = await listClients(session);
    total = clients.length;
    content =
      clients.length === 0 ? (
        <div className="empty-list">{t("clients.empty")}</div>
      ) : (
        <div className="clist">
          {clients.map((c) => (
            <div className="dcard" key={c.id}>
              <div className="chips">
                <span className="chip">{clientTypeLabel(c.type)}</span>
                {c.city && <span className="chip">📍 {c.city}</span>}
                <span className={`chip st${c.status === ClientStatus.ACTIVE ? "" : " done"}`}>
                  {clientStatusLabel(c.status)}
                </span>
              </div>
              <h3>{c.name}</h3>
              <div className="sub">
                {t("clients.casesCount", { n: c._count.cases })}
                {c.phone ? ` · ${c.phone}` : ""}
              </div>
            </div>
          ))}
        </div>
      );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("clients.title")}</h2>
        <span className="pill">{t("clients.pill", { n: total.toLocaleString("ar-SA") })}</span>
      </div>
      {content}
    </AppShell>
  );
}
