import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { agingReport, trialBalance, vatReturn } from "@/server/ledger-reports";
import { PermissionError } from "@/lib/permissions/guard";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";

export default async function LedgerPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const [trial, vat, aging] = await Promise.all([
      trialBalance(session),
      vatReturn(session),
      agingReport(session),
    ]);
    const totalDr = trial.reduce((s, r) => s + r.debit, 0);
    const totalCr = trial.reduce((s, r) => s + r.credit, 0);

    content = (
      <div className="space-y-6">
        {/* VAT return */}
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-3 font-serif text-xl text-bench">{t("ledger.vatReturn")}</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><div className="text-xs text-ink-soft">{t("ledger.outputVat")}</div><div className="font-medium">{formatSar(vat.outputVat)}</div></div>
            <div><div className="text-xs text-ink-soft">{t("ledger.inputVat")}</div><div className="font-medium">{formatSar(vat.inputVat)}</div></div>
            <div>
              <div className="text-xs text-ink-soft">{t("ledger.netVat")}</div>
              <div className="font-semibold text-bench">
                {formatSar(Math.abs(vat.net))} · {vat.payable ? t("ledger.payable") : t("ledger.refundable")}
              </div>
            </div>
          </div>
        </section>

        {/* Aging */}
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="mb-3 font-serif text-xl text-bench">{t("ledger.aging")}</h2>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <Bucket label={t("ledger.b0_30")} value={aging.buckets.b0_30} />
            <Bucket label={t("ledger.b31_60")} value={aging.buckets.b31_60} />
            <Bucket label={t("ledger.b61_90")} value={aging.buckets.b61_90} />
            <Bucket label={t("ledger.b90_plus")} value={aging.buckets.b90_plus} />
          </div>
        </section>

        {/* Trial balance */}
        <section>
          <h2 className="mb-3 font-serif text-xl text-bench">{t("ledger.trialBalance")}</h2>
          <div className="panel overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-line text-ink-soft">
                <tr>
                  <th className="p-3 font-medium">{t("ledger.account")}</th>
                  <th className="p-3 font-medium">{t("ledger.debit")}</th>
                  <th className="p-3 font-medium">{t("ledger.credit")}</th>
                </tr>
              </thead>
              <tbody>
                {trial.map((r) => (
                  <tr key={r.code} className="border-b border-parch-line last:border-0">
                    <td className="p-3">{r.code} · {r.name}</td>
                    <td className="p-3">{r.debit ? formatSar(r.debit) : "—"}</td>
                    <td className="p-3">{r.credit ? formatSar(r.credit) : "—"}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-line font-semibold">
                  <td className="p-3">{t("ledger.total")}</td>
                  <td className="p-3">{formatSar(totalDr)}</td>
                  <td className="p-3">{formatSar(totalCr)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
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

function Bucket({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-parch-line bg-parch p-3">
      <div className="text-xs text-ink-soft">{label}</div>
      <div className="mt-1 font-medium">{formatSar(value)}</div>
    </div>
  );
}
