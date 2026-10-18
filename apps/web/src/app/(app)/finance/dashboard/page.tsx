import { financeDashboard } from "@murafaa/sdk";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("ar-SA", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y!, (m ?? 1) - 1, 1)));
};

/** لوحة مالية (legacy finance dashboard). */
export default async function FinanceDashboardPage() {
  const d = (await financeDashboard({ client: await serverApi() })).data?.data;
  if (!d) return <DeniedPanel />;
  const max = Math.max(1, ...d.revenueByMonth.map((r) => r.total));
  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <div className="v">{formatSar(d.outstanding)}</div>
          <div className="l">{t("finDash.kpi.outstanding")}</div>
        </div>
        <div className="kpi">
          <div className="v">{d.overdueCount.toLocaleString("ar-SA")}</div>
          <div className="l">{t("finDash.kpi.overdue")}</div>
        </div>
        <div className="kpi">
          <div className="v">{formatSar(d.monthRevenue)}</div>
          <div className="l">{t("finDash.kpi.monthRevenue")}</div>
        </div>
        <div className="kpi">
          <div className="v">{formatSar(d.monthExpense)}</div>
          <div className="l">{t("finDash.kpi.monthExpense")}</div>
        </div>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("finDash.revenueByMonth")}</h2>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 140 }}>
          {d.revenueByMonth.map((r) => (
            <div key={r.month} style={{ flex: 1, textAlign: "center" }}>
              <div
                style={{
                  height: Math.max(4, (r.total / max) * 110),
                  background: "var(--bench)",
                  borderRadius: 6,
                  marginBottom: 6,
                }}
                title={formatSar(r.total)}
              />
              <div className="sub" style={{ fontSize: 13.75 }}>
                {monthLabel(r.month)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("finDash.recent")}</h2>
        {d.recent.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("finance.empty")}
          </div>
        ) : (
          <div className="clist">
            {d.recent.map((r) => (
              <div key={`${r.kind}:${r.id}`} className="approve-row">
                <span className="chip">{t(`finDash.kind.${r.kind}` as MessageKey)}</span>
                <span className="at">
                  {r.label ?? (r.category ? t(`expCat.${r.category}` as MessageKey) : "—")}
                </span>
                <span className="sub" style={{ marginInlineEnd: 8 }}>
                  {r.date}
                </span>
                <span className="chip">{formatSar(r.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
