import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { listTimeEntries } from "@/server/expenses";
import { getCaseProfitability } from "@/server/case-profitability";
import { PermissionError } from "@/lib/permissions/guard";
import { formatSar } from "@/lib/money";
import { RIYADH_TZ } from "@/lib/dates";
import { t } from "@/lib/i18n";
import { invoiceTimeEntryAction } from "../actions";

const arNum = (n: number) => n.toLocaleString("ar-SA");
const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, dateStyle: "medium" }).format(d);

export default async function ProfitabilityPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const [entries, profitability] = await Promise.all([
      listTimeEntries(session),
      getCaseProfitability(session),
    ]);

    content = (
      <>
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>{t("finProfit.hint")}</div>
        </div>

        <div className="panel overflow-x-auto">
          <h2 style={{ marginTop: 0 }}>{t("finProfit.timeLog")}</h2>
          <table className="w-full text-right text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="p-3 font-medium">{t("finProfit.col.case")}</th>
                <th className="p-3 font-medium">{t("finProfit.col.lawyer")}</th>
                <th className="p-3 font-medium">{t("finProfit.col.date")}</th>
                <th className="p-3 font-medium">{t("finProfit.col.hours")}</th>
                <th className="p-3 font-medium">{t("finProfit.col.value")}</th>
                <th className="p-3 font-medium">{t("finProfit.col.invoiced")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-parch-line last:border-0">
                  <td className="p-3">{e.case.title}</td>
                  <td className="p-3 text-ink-soft">{e.lawyer.name}</td>
                  <td className="p-3 text-ink-soft">{fmtDate(e.workDate)}</td>
                  <td className="p-3">{arNum(Math.round((e.minutes / 60) * 100) / 100)}</td>
                  <td className="p-3">{formatSar(Math.round((e.minutes / 60) * e.hourlyRate))}</td>
                  <td className="p-3">
                    {e.invoiced ? (
                      "✓"
                    ) : e.billable ? (
                      <form action={invoiceTimeEntryAction}>
                        <input type="hidden" name="entryId" value={e.id} />
                        <button type="submit" className="tinybtn">
                          {t("finProfit.invoiceEntry")}
                        </button>
                      </form>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel overflow-x-auto">
          <h2 style={{ marginTop: 0 }}>{t("finProfit.caseProfitability")}</h2>
          <table className="w-full text-right text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="p-3 font-medium">{t("finProfit.col.case")}</th>
                <th className="p-3 font-medium">{t("finProfit.col.fees")}</th>
                <th className="p-3 font-medium">{t("finProfit.col.expenses")}</th>
                <th className="p-3 font-medium">{t("finProfit.col.margin")}</th>
              </tr>
            </thead>
            <tbody>
              {profitability.map((r) => (
                <tr key={r.caseId} className="border-b border-parch-line last:border-0">
                  <td className="p-3">
                    <Link href={`/cases/${r.caseId}`} className="hover:underline">{r.caseTitle}</Link>
                  </td>
                  <td className="p-3">{formatSar(r.feesMinor)}</td>
                  <td className="p-3">{formatSar(r.expensesMinor)}</td>
                  <td className="p-3" style={{ color: r.marginMinor >= 0 ? "var(--ok)" : "var(--advocate)" }}>
                    {formatSar(r.marginMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
