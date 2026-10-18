import { overviewDashboard } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

const arNum = (n: number) => n.toLocaleString("ar-SA");

/** لوحة المعلومات (legacy dashboard page). */
export default async function DashboardPage() {
  const api = await serverApi();
  const s = (await overviewDashboard({ client: api })).data?.data;
  const kpis: Array<[string, string]> = s
    ? [
        [t("dashboard.kpi.activeCases"), arNum(s.activeCases)],
        [
          t("dashboard.kpi.winRate"),
          s.winRatePct === null ? "—" : t("common.percent", { n: arNum(s.winRatePct) }),
        ],
        [t("dashboard.kpi.criticalAlerts"), arNum(s.criticalAlerts)],
        [t("dashboard.kpi.clients"), arNum(s.clients)],
        [t("dashboard.kpi.openTasks"), arNum(s.openTasks)],
      ]
    : [];
  return (
    <>
      <div className="vhead">
        <h2>{t("dashboard.title")}</h2>
        <span className="pill">{t("dashboard.pill")}</span>
      </div>
      {!s ? (
        <DeniedPanel />
      ) : (
        <>
          <div className="kpis">
            {kpis.map(([label, value]) => (
              <div className="kpi" key={label}>
                <div className="v">{value}</div>
                <div className="l">{label}</div>
              </div>
            ))}
          </div>
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>{t("dashboard.byClassification")}</h2>
            {s.byClassification.length === 0 ? (
              <div className="sub" style={{ marginBottom: 0 }}>
                {t("dashboard.byClassification.empty")}
              </div>
            ) : (
              <div className="clist">
                {s.byClassification.map((c) => (
                  <div key={c.label} className="approve-row">
                    <span className="at">{c.label}</span>
                    <span className="chip">{arNum(c.count)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
