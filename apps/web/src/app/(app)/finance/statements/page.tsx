import {
  financeListInvoices,
  financeParties,
  financeStatements,
  financeTrustLedger,
} from "@murafaa/sdk";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="approve-row">
      <span className="at" style={{ fontWeight: bold ? 700 : 400 }}>
        {label}
      </span>
      <span className="chip">{formatSar(value)}</span>
    </div>
  );
}

/** القوائم المالية + كشف حساب العميل (legacy statements page). */
export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { clientId } = await searchParams;
  const api = await serverApi();
  const [stRes, partiesRes] = await Promise.all([
    financeStatements({ client: api }),
    financeParties({ client: api }),
  ]);
  const s = stRes.data?.data;
  if (!s) return <DeniedPanel />;
  const clients = partiesRes.data?.data.clients ?? [];
  const valid = clients.some((c) => c.id === clientId) ? clientId : undefined;
  const [invRes, trustRes] = valid
    ? await Promise.all([
        financeListInvoices({ client: api, query: { clientId: valid } }),
        financeTrustLedger({ client: api, path: { clientId: valid } }),
      ])
    : [undefined, undefined];
  const invoices = invRes?.data?.data;
  const outstanding = invoices?.reduce((sum, i) => sum + i.remaining, 0) ?? 0;
  const cf = s.cashFlow;
  return (
    <>
      <div className="panel">
        <div className="sub" style={{ marginBottom: 0 }}>
          {t("finStmt.hint")}
        </div>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("finStmt.income.title")}</h2>
        <div className="clist">
          <Row label={t("finStmt.income.revenue")} value={s.revenue} />
          <Row label={t("finStmt.income.expenses")} value={s.expenses} />
          <Row label={t("finStmt.income.net")} value={s.netIncome} bold />
        </div>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("finStmt.balance.title")}</h2>
        <div className="clist">
          <Row label={t("finStmt.balance.assets")} value={s.assets} bold />
          <Row label={t("finStmt.balance.liabilities")} value={s.liabilities} />
          <Row label={t("finStmt.balance.equity")} value={s.equity} />
          <Row label={t("finStmt.income.net")} value={s.netIncome} />
        </div>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("finStmt.cashFlow.title")}</h2>
        <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
          {t("finStmt.cashFlow.operatingHeader")}
        </div>
        <div className="clist">
          <Row label={t("finStmt.cashFlow.collected")} value={cf.collected} />
          <Row label={t("finStmt.cashFlow.trustToFees")} value={cf.trustToFees} />
          <Row label={t("finStmt.cashFlow.expensePaid")} value={-cf.expensePaid} />
          <Row label={t("finStmt.cashFlow.operatingNet")} value={cf.operating} bold />
        </div>
        <div className="sub" style={{ marginTop: 8, fontSize: 14.375 }}>
          {t("finStmt.cashFlow.reconNote", { amount: formatSar(cf.cashBank) })}
        </div>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("finStmt.client.title")}</h2>
        <form method="GET" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <select name="clientId" defaultValue={valid ?? ""} required>
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
        {invoices && (
          <>
            <div className="kpis" style={{ marginBottom: 16 }}>
              <div className="kpi">
                <div className="v">{formatSar(outstanding)}</div>
                <div className="l">{t("finStmt.client.totalOutstanding")}</div>
              </div>
              <div className="kpi">
                <div className="v">{formatSar(trustRes?.data?.data.balance ?? 0)}</div>
                <div className="l">{t("finStmt.client.trustBalance")}</div>
              </div>
            </div>
            {invoices.length === 0 ? (
              <div className="sub" style={{ marginBottom: 0 }}>
                {t("finStmt.client.noInvoices")}
              </div>
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
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-line last:border-0">
                      <td className="p-3 font-medium">{inv.number}</td>
                      <td className="p-3 text-ink-soft">{inv.caseTitle ?? "—"}</td>
                      <td className="p-3 text-ink-soft">{inv.issueDate}</td>
                      <td className="p-3">{formatSar(inv.total)}</td>
                      <td className="p-3">{formatSar(inv.paid)}</td>
                      <td className="p-3">{formatSar(inv.remaining)}</td>
                      <td className="p-3">{t(`invStatus.${inv.status}` as MessageKey)}</td>
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
}
