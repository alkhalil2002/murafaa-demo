import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { getFinancialStatements, getCashFlowStatement } from "@/server/ledger-reports";
import { listInvoicesByClient } from "@/server/invoices";
import { listTrustAccounts } from "@/server/trust";
import { listClients } from "@/server/clients";
import { PermissionError } from "@/lib/permissions/guard";
import { invoiceStatusLabel } from "@/lib/labels";
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

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { clientId } = await searchParams;

  let content: React.ReactNode;
  try {
    const [s, cf, clients] = await Promise.all([
      getFinancialStatements(session),
      getCashFlowStatement(session),
      listClients(session),
    ]);
    const [clientInvoices, trustAccounts] = clientId
      ? await Promise.all([listInvoicesByClient(session, clientId), listTrustAccounts(session)])
      : [null, null];
    const trustBalance = trustAccounts?.find((a) => a.clientId === clientId)?.balanceMinor ?? 0;
    const totalOutstanding = clientInvoices?.reduce((sum, inv) => sum + inv.remaining, 0) ?? 0;

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
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("finStmt.cashFlow.title")}</h2>
          <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
            {t("finStmt.cashFlow.operatingHeader")}
          </div>
          <div className="clist">
            <Row label={t("finStmt.cashFlow.collected")} value={cf.collectedMinor} />
            <Row label={t("finStmt.cashFlow.trustToFees")} value={cf.trustToFeesMinor} />
            <Row label={t("finStmt.cashFlow.expensePaid")} value={-cf.expensePaidMinor} />
            <Row label={t("finStmt.cashFlow.operatingNet")} value={cf.operatingMinor} bold />
          </div>
          <div className="sub" style={{ fontWeight: 600, marginTop: 12, marginBottom: 6 }}>
            {t("finStmt.cashFlow.reconHeader")}
          </div>
          <div className="clist">
            <Row label={t("finStmt.cashFlow.opening")} value={cf.openingCashMinor} />
            <Row label={t("finStmt.cashFlow.closing")} value={cf.closingCashMinor} bold />
          </div>
          <div className="sub" style={{ marginTop: 8, fontSize: 14.375 }}>
            {t("finStmt.cashFlow.reconNote", { amount: formatSar(cf.cashBankMinor) })}
          </div>
        </div>
        <div className="panel overflow-x-auto">
          <h2 style={{ marginTop: 0 }}>{t("finStmt.client.title")}</h2>
          <form method="GET" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <select name="clientId" defaultValue={clientId ?? ""} required>
              <option value="" disabled>
                {t("finStmt.client.select")}
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="submit" className="tinybtn">
              {t("finStmt.client.view")}
            </button>
          </form>
          {clientInvoices && (
            <>
              <div className="kpis" style={{ marginBottom: 16 }}>
                <div className="kpi">
                  <div className="v">{formatSar(totalOutstanding)}</div>
                  <div className="l">{t("finStmt.client.totalOutstanding")}</div>
                </div>
                <div className="kpi">
                  <div className="v">{formatSar(trustBalance)}</div>
                  <div className="l">{t("finStmt.client.trustBalance")}</div>
                </div>
              </div>
              {clientInvoices.length === 0 ? (
                <p className="text-ink-soft">{t("finStmt.client.noInvoices")}</p>
              ) : (
                <table className="w-full text-right text-sm">
                  <thead className="border-b border-line text-ink-soft">
                    <tr>
                      <th className="p-3 font-medium">{t("finStmt.client.col.number")}</th>
                      <th className="p-3 font-medium">{t("finStmt.client.col.case")}</th>
                      <th className="p-3 font-medium">{t("finStmt.client.col.date")}</th>
                      <th className="p-3 font-medium">{t("finStmt.client.col.total")}</th>
                      <th className="p-3 font-medium">{t("finStmt.client.col.paid")}</th>
                      <th className="p-3 font-medium">{t("finStmt.client.col.remaining")}</th>
                      <th className="p-3 font-medium">{t("finStmt.client.col.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientInvoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-parch-line last:border-0">
                        <td className="p-3 font-medium">{inv.number}</td>
                        <td className="p-3 text-ink-soft">{inv.caseTitle ?? "—"}</td>
                        <td className="p-3 text-ink-soft">{inv.issueDate}</td>
                        <td className="p-3">{formatSar(inv.total)}</td>
                        <td className="p-3">{formatSar(inv.paid)}</td>
                        <td className="p-3">{formatSar(inv.remaining)}</td>
                        <td className="p-3">{invoiceStatusLabel(inv.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
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
