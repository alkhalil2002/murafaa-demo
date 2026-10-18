import { authCurrent, crmClients, crmKpis } from "@murafaa/sdk";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { ClientCreateForm, ClientEditForm } from "@/components/crm/client-forms";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

const arNum = (n: number) => n.toLocaleString("ar-SA");

export default async function ClientsPage() {
  const api = await serverApi();
  const [me, clientsRes, kpisRes] = await Promise.all([
    authCurrent({ client: api }),
    crmClients({ client: api }),
    crmKpis({ client: api }),
  ]);
  const clients = clientsRes.data?.data;
  const kpis = kpisRes.data?.data;
  const level = me.data?.data.modules.CLIENTS;
  const canEdit = level === "EDIT" || level === "FULL";

  return (
    <>
      <div className="vhead">
        <h2>{t("clients.title")}</h2>
        <span className="pill">{t("clients.pill", { n: arNum(clients?.length ?? 0) })}</span>
      </div>
      {!clients || !kpis ? (
        <DeniedPanel />
      ) : (
        <>
          <div className="kpis" style={{ marginBottom: 16 }}>
            <div className="kpi">
              <div className="v">{arNum(kpis.activeCount)}</div>
              <div className="l">{t("clients.kpiActiveLeads")}</div>
            </div>
            <div className="kpi">
              <div className="v">{formatSar(kpis.pipelineValue)}</div>
              <div className="l">{t("clients.kpiPipelineValue")}</div>
            </div>
            <div className="kpi">
              <div className="v">{arNum(clients.filter((c) => c.status === "ACTIVE").length)}</div>
              <div className="l">{t("clients.kpiActiveClients")}</div>
            </div>
            <div className="kpi">
              <div className="v">%{arNum(kpis.conversionRatePct)}</div>
              <div className="l">{t("clients.kpiConversion")}</div>
            </div>
          </div>
          {canEdit && <ClientCreateForm />}
          {clients.length === 0 ? (
            <div className="empty-list">{t("clients.empty")}</div>
          ) : (
            <div className="clist">
              {clients.map((c) => (
                <div className="dcard" key={c.id}>
                  <div className="chips">
                    <span className="chip">{t(`clientType.${c.type}` as MessageKey)}</span>
                    {c.city && <span className="chip">📍 {c.city}</span>}
                    <span className={`chip st${c.status === "ACTIVE" ? "" : " done"}`}>
                      {t(`clientStatus.${c.status}` as MessageKey)}
                    </span>
                  </div>
                  <h3>{c.name}</h3>
                  <div className="sub">
                    {t("clients.casesCount", { n: c.casesCount })}
                    {c.phone ? (
                      <>
                        {" · "}
                        <span dir="ltr">{c.phone}</span>
                      </>
                    ) : null}
                  </div>
                  {canEdit && <ClientEditForm client={c} />}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
