import { redirect } from "next/navigation";
import { ClientStatus, ClientType, PermModule } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { listClients } from "@/server/clients";
import { getLeadsKpis } from "@/server/leads";
import { PermissionError, canAction } from "@/lib/permissions/guard";
import { clientStatusLabel, clientTypeLabel } from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";
import { createClientAction, updateClientAction } from "./actions";

export default async function ClientsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  let total = 0;
  try {
    const [clients, canEdit, kpis] = await Promise.all([
      listClients(session),
      canAction(session, PermModule.CLIENTS, "edit"),
      getLeadsKpis(session),
    ]);
    total = clients.length;
    const activeClients = clients.filter((c) => c.status === ClientStatus.ACTIVE).length;
    content = (
      <>
        <div className="kpis" style={{ marginBottom: 16 }}>
          <div className="kpi">
            <div className="v">{kpis.activeCount.toLocaleString("ar-SA")}</div>
            <div className="l">{t("clients.kpiActiveLeads")}</div>
          </div>
          <div className="kpi">
            <div className="v">{formatSar(kpis.pipelineValue)}</div>
            <div className="l">{t("clients.kpiPipelineValue")}</div>
          </div>
          <div className="kpi">
            <div className="v">{activeClients.toLocaleString("ar-SA")}</div>
            <div className="l">{t("clients.kpiActiveClients")}</div>
          </div>
          <div className="kpi">
            <div className="v">%{kpis.conversionRatePct.toLocaleString("ar-SA")}</div>
            <div className="l">{t("clients.kpiConversion")}</div>
          </div>
        </div>
        {canEdit && (
          <div className="panel">
            <form action={createClientAction} className="three" style={{ alignItems: "flex-end" }}>
              <div className="field">
                <label>{t("clients.new")}</label>
                <input type="text" name="name" placeholder={t("clients.name")} required />
              </div>
              <div className="field">
                <label>{t("clients.phone")}</label>
                <input type="text" name="phone" />
              </div>
              <div className="field">
                <label>{t("clients.city")}</label>
                <input type="text" name="city" />
              </div>
              <div className="field">
                <label>{t("clients.type")}</label>
                <select name="type" defaultValue={ClientType.INDIVIDUAL}>
                  {Object.values(ClientType).map((ty) => (
                    <option key={ty} value={ty}>
                      {clientTypeLabel(ty)}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="act b-add">
                {t("clients.addSubmit")}
              </button>
            </form>
          </div>
        )}
        {clients.length === 0 ? (
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
                {canEdit && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer", fontSize: 14.375, color: "var(--bench)" }}>
                      {t("clients.edit")}
                    </summary>
                    <form action={updateClientAction} style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="text" name="name" defaultValue={c.name} placeholder={t("clients.name")} required />
                      <input type="text" name="phone" defaultValue={c.phone ?? ""} placeholder={t("clients.phone")} />
                      <input type="text" name="city" defaultValue={c.city ?? ""} placeholder={t("clients.city")} />
                      <select name="status" defaultValue={c.status}>
                        {Object.values(ClientStatus).map((st) => (
                          <option key={st} value={st}>
                            {clientStatusLabel(st)}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="tinybtn">
                        {t("clients.save")}
                      </button>
                    </form>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </>
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
