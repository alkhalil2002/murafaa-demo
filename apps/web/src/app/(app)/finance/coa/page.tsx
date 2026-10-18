import { financeLedgerReport } from "@murafaa/sdk";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

/** دليل الحسابات with each account's balance (legacy coa page). */
export default async function ChartOfAccountsPage() {
  const r = (await financeLedgerReport({ client: await serverApi() })).data?.data;
  if (!r) return <DeniedPanel />;
  return (
    <div className="panel">
      <div className="sub" style={{ marginBottom: 12 }}>
        {t("finCoa.hint")}
      </div>
      <table className="w-full text-right text-sm">
        <thead className="border-b border-line text-ink-soft">
          <tr>
            <th className="p-3 font-medium">{t("finCoa.col.code")}</th>
            <th className="p-3 font-medium">{t("finCoa.col.name")}</th>
            <th className="p-3 font-medium">{t("finCoa.col.type")}</th>
            <th className="p-3 font-medium">{t("finCoa.col.balance")}</th>
          </tr>
        </thead>
        <tbody>
          {r.trial.map((x) => (
            <tr key={x.code} className="border-b border-line last:border-0">
              <td className="p-3 text-ink-soft">{x.code}</td>
              <td className="p-3">{x.name}</td>
              <td className="p-3 text-ink-soft">{t(`accType.${x.type}` as MessageKey)}</td>
              <td className="p-3">{formatSar(x.debit || x.credit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
