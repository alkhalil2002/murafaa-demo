import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { getBankSummary } from "@/server/finance-bank";
import { PermissionError } from "@/lib/permissions/guard";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";

function Account({ title, inflow, outflow }: { title: string; inflow: number; outflow: number }) {
  const net = inflow - outflow;
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div className="kpis">
        <div className="kpi"><div className="v">{formatSar(inflow)}</div><div className="l">{t("finBank.inflow")}</div></div>
        <div className="kpi"><div className="v">{formatSar(outflow)}</div><div className="l">{t("finBank.outflow")}</div></div>
        <div className="kpi"><div className="v" style={{ color: net >= 0 ? "var(--ok)" : "var(--advocate)" }}>{formatSar(net)}</div><div className="l">{t("finBank.balance")}</div></div>
      </div>
    </div>
  );
}

export default async function BankPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const s = await getBankSummary(session);
    content = (
      <>
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>{t("finBank.hint")}</div>
        </div>
        <Account title={t("finBank.account.current")} inflow={s.currentAccount.inflowMinor} outflow={s.currentAccount.outflowMinor} />
        <Account title={t("finBank.account.cash")} inflow={s.cash.inflowMinor} outflow={s.cash.outflowMinor} />
        <Account title={t("finBank.account.cheques")} inflow={s.cheques.inflowMinor} outflow={s.cheques.outflowMinor} />
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("finBank.account.trust")}</h2>
          <div className="kpis">
            <div className="kpi"><div className="v">{formatSar(s.trustBalanceMinor)}</div><div className="l">{t("finBank.balance")}</div></div>
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
