import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { getDashboardSummary } from "@/server/dashboard";
import { getDashboardCharts } from "@/server/dashboard-charts";
import { ChartFrame, TimeSeries, HorizontalBars, StatusBars } from "@/components/charts/charts";
import { PermissionError } from "@/lib/permissions/guard";
import type { Urgency } from "@/lib/dates";
import { t } from "@/lib/i18n";

const arNum = (n: number) => n.toLocaleString("ar-SA");

/**
 * Categorical slots, in fixed order — mirrors the --chart-N custom properties
 * in globals.css. Read here as literals rather than var() because they are
 * passed into inline SVG fills and gradient stops.
 */
const CHART = ["#008a72", "#b8541a", "#3d6fd0", "#b03a5e", "#8f9111", "#8a4fc0"] as const;

/** Urgency bands map to the reserved status palette, never a categorical hue. */
const URGENCY_TONE: Record<Urgency, "critical" | "serious" | "warning" | "good"> = {
  overdue: "critical",
  critical: "serious",
  soon: "warning",
  upcoming: "good",
  normal: "good",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const [s, charts] = await Promise.all([
      getDashboardSummary(session),
      getDashboardCharts(session),
    ]);
    const kpis: Array<[string, string]> = [
      [t("dashboard.kpi.activeCases"), arNum(s.activeCases)],
      [t("dashboard.kpi.winRate"), s.winRatePct === null ? "—" : `${arNum(s.winRatePct)}٪`],
      [t("dashboard.kpi.criticalAlerts"), arNum(s.criticalAlerts)],
      [t("dashboard.kpi.clients"), arNum(s.clients)],
      [t("dashboard.kpi.openTasks"), arNum(s.openTasks)],
    ];

    content = (
      <>
        <div className="kpis kpis-5">
          {kpis.map(([label, value]) => (
            <div className="kpi" key={label}>
              <div className="v">{value}</div>
              <div className="l">{label}</div>
            </div>
          ))}
        </div>

        <div className="charts-grid">
          {charts.caseIntake && (
            <ChartFrame title={t("dashboard.chart.intake")} hint={t("dashboard.chart.months")}>
              <TimeSeries
                points={charts.caseIntake.map((p) => ({ ...p, values: [p.value] }))}
                series={[{ label: t("dashboard.chart.intake"), color: CHART[0] }]}
                emptyLabel={t("dashboard.chart.empty")}
              />
            </ChartFrame>
          )}

          {charts.revenue && (
            <ChartFrame
              title={t("dashboard.chart.revenue")}
              hint={t("dashboard.chart.months")}
              legend={[
                { label: t("dashboard.chart.invoiced"), color: CHART[2] },
                { label: t("dashboard.chart.collected"), color: CHART[0] },
              ]}
            >
              <TimeSeries
                money
                points={charts.revenue.map((p) => ({ key: p.key, label: p.label, values: [p.a, p.b] }))}
                series={[
                  { label: t("dashboard.chart.invoiced"), color: CHART[2] },
                  { label: t("dashboard.chart.collected"), color: CHART[0] },
                ]}
                emptyLabel={t("dashboard.chart.empty")}
              />
            </ChartFrame>
          )}

          {charts.byClassification && (
            <ChartFrame title={t("dashboard.byClassification")}>
              <HorizontalBars
                items={charts.byClassification.map((c) => ({ label: c.label, value: c.count }))}
                palette={CHART}
                emptyLabel={t("dashboard.byClassification.empty")}
              />
            </ChartFrame>
          )}

          {charts.deadlinesByUrgency && (
            <ChartFrame title={t("dashboard.chart.urgency")}>
              <StatusBars
                items={charts.deadlinesByUrgency.map((d) => ({
                  label: t(`urgency.${d.urgency}` as never),
                  value: d.count,
                  tone: URGENCY_TONE[d.urgency],
                }))}
                emptyLabel={t("dashboard.chart.empty")}
              />
            </ChartFrame>
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
