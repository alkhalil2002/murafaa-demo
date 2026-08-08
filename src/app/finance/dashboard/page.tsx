import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { getFinanceDashboard } from "@/server/finance-dashboard";
import { PermissionError } from "@/lib/permissions/guard";
import { formatSar } from "@/lib/money";
import { RIYADH_TZ } from "@/lib/dates";
import { t, type MessageKey } from "@/lib/i18n";

const arNum = (n: number) => n.toLocaleString("ar-SA");

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, dateStyle: "medium" }).format(d);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("ar-SA", { month: "short", year: "2-digit" }).format(new Date(y!, (m ?? 1) - 1, 1));
}

export default async function FinanceDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const d = await getFinanceDashboard(session);
    const maxRevenue = Math.max(1, ...d.revenueByMonth.map((r) => r.totalMinor));

    content = (
      <>
        <div className="kpis">
          <div className="kpi"><div className="v">{formatSar(d.outstandingMinor)}</div><div className="l">{t("finDash.kpi.outstanding")}</div></div>
          <div className="kpi"><div className="v">{arNum(d.overdueCount)}</div><div className="l">{t("finDash.kpi.overdue")}</div></div>
          <div className="kpi"><div className="v">{formatSar(d.monthRevenueMinor)}</div><div className="l">{t("finDash.kpi.monthRevenue")}</div></div>
          <div className="kpi"><div className="v">{formatSar(d.monthExpenseMinor)}</div><div className="l">{t("finDash.kpi.monthExpense")}</div></div>
        </div>

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("finDash.revenueByMonth")}</h2>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 140 }}>
            {d.revenueByMonth.map((r) => (
              <div key={r.month} style={{ flex: 1, textAlign: "center" }}>
                <div
                  style={{
                    height: Math.max(4, (r.totalMinor / maxRevenue) * 110),
                    background: "var(--bench)",
                    borderRadius: 6,
                    marginBottom: 6,
                  }}
                  title={formatSar(r.totalMinor)}
                />
                <div className="sub" style={{ fontSize: 11 }}>{monthLabel(r.month)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("finDash.recent")}</h2>
          {d.recent.length === 0 ? (
            <div className="sub" style={{ marginBottom: 0 }}>{t("finance.empty")}</div>
          ) : (
            <div className="clist">
              {d.recent.map((r) => (
                <div key={`${r.kind}:${r.id}`} className="approve-row">
                  <span className="chip">{t(`finDash.kind.${r.kind}` as MessageKey)}</span>
                  <span className="at">{r.label}</span>
                  <span className="sub" style={{ marginInlineEnd: 8 }}>{formatWhen(r.at)}</span>
                  <span className="chip">{formatSar(r.amountMinor)}</span>
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
      <div className="vhead"><h2>{t("finance.title")}</h2></div>
      <FinanceTabs />
      {content}
    </AppShell>
  );
}
