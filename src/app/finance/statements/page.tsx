import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { getFinancialStatements } from "@/server/ledger-reports";
import { PermissionError } from "@/lib/permissions/guard";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="approve-row">
      <span className="at" style={{ fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span className="chip">{formatSar(value)}</span>
    </div>
  );
}

export default async function StatementsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const s = await getFinancialStatements(session);
    content = (
      <>
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>{t("finStmt.hint")}</div>
        </div>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("finStmt.income.title")}</h2>
          <div className="clist">
            <Row label={t("finStmt.income.revenue")} value={s.revenueMinor} />
            <Row label={t("finStmt.income.expenses")} value={s.expensesMinor} />
            <Row label={t("finStmt.income.net")} value={s.netIncomeMinor} bold />
          </div>
        </div>
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("finStmt.balance.title")}</h2>
          <div className="clist">
            <Row label={t("finStmt.balance.assets")} value={s.assetsMinor} bold />
            <Row label={t("finStmt.balance.liabilities")} value={s.liabilitiesMinor} />
            <Row label={t("finStmt.balance.equity")} value={s.equityMinor} />
          </div>
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
