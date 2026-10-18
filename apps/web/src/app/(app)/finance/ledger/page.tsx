import { financeLedgerReport } from "@murafaa/sdk";
import { formatSar, t } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

function Box({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="kpi">
      <div className="v" style={{ fontSize: 20, ...(strong ? { color: "var(--bench)" } : {}) }}>
        {value}
      </div>
      <div className="l">{label}</div>
    </div>
  );
}

/** الدفاتر: VAT return, receivables aging and the trial balance (legacy ledger page). */
export default async function LedgerPage() {
  const r = (await financeLedgerReport({ client: await serverApi() })).data?.data;
  if (!r) return <DeniedPanel />;
  const dr = r.trial.reduce((s, x) => s + x.debit, 0);
  const cr = r.trial.reduce((s, x) => s + x.credit, 0);
  return (
    <>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("ledger.vatReturn")}</h2>
        <div className="kpis">
          <Box label={t("ledger.outputVat")} value={formatSar(r.vat.outputVat)} />
          <Box label={t("ledger.inputVat")} value={formatSar(r.vat.inputVat)} />
          <Box
            label={t("ledger.netVat")}
            value={`${formatSar(Math.abs(r.vat.net))} · ${r.vat.payable ? t("ledger.payable") : t("ledger.refundable")}`}
            strong
          />
        </div>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("ledger.aging")}</h2>
        <div className="kpis">
          <Box label={t("ledger.b0_30")} value={formatSar(r.aging.buckets.b0_30 ?? 0)} />
          <Box label={t("ledger.b31_60")} value={formatSar(r.aging.buckets.b31_60 ?? 0)} />
          <Box label={t("ledger.b61_90")} value={formatSar(r.aging.buckets.b61_90 ?? 0)} />
          <Box label={t("ledger.b90_plus")} value={formatSar(r.aging.buckets.b90_plus ?? 0)} />
        </div>
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("ledger.trialBalance")}</h2>
        <table className="w-full text-right text-sm">
          <thead className="border-b border-line text-ink-soft">
            <tr>
              <th className="p-3 font-medium">{t("ledger.account")}</th>
              <th className="p-3 font-medium">{t("ledger.debit")}</th>
              <th className="p-3 font-medium">{t("ledger.credit")}</th>
            </tr>
          </thead>
          <tbody>
            {r.trial.map((x) => (
              <tr key={x.code} className="border-b border-line last:border-0">
                <td className="p-3">
                  {x.code} · {x.name}
                </td>
                <td className="p-3">{x.debit ? formatSar(x.debit) : "—"}</td>
                <td className="p-3">{x.credit ? formatSar(x.credit) : "—"}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-line font-semibold">
              <td className="p-3">{t("ledger.total")}</td>
              <td className="p-3">{formatSar(dr)}</td>
              <td className="p-3">{formatSar(cr)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
