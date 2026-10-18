import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { getDashboardSummary } from "@/server/dashboard";
import { PermissionError } from "@/lib/permissions/guard";
import { t } from "@/lib/i18n";

const arNum = (n: number) => n.toLocaleString("ar-SA");

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const s = await getDashboardSummary(session);
    const kpis: Array<[string, string]> = [
      [t("dashboard.kpi.activeCases"), arNum(s.activeCases)],
      [t("dashboard.kpi.winRate"), s.winRatePct === null ? "—" : `${arNum(s.winRatePct)}٪`],
      [t("dashboard.kpi.criticalAlerts"), arNum(s.criticalAlerts)],
      [t("dashboard.kpi.clients"), arNum(s.clients)],
      [t("dashboard.kpi.openTasks"), arNum(s.openTasks)],
    ];

    content = (
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
            <div className="sub" style={{ marginBottom: 0 }}>{t("dashboard.byClassification.empty")}</div>
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
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("dashboard.title")}</h2>
        <span className="pill">{t("dashboard.pill")}</span>
      </div>
      {content}
    </AppShell>
  );
}
