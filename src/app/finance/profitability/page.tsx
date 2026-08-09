import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { listTimeEntries } from "@/server/expenses";
import { getCaseProfitability } from "@/server/case-profitability";
import { listCases, listAssignableUsers } from "@/server/cases";
import { PermissionError, canAction } from "@/lib/permissions/guard";
import { PermModule } from "@prisma/client";
import { formatSar } from "@/lib/money";
import { RIYADH_TZ } from "@/lib/dates";
import { t } from "@/lib/i18n";
import { invoiceTimeEntryAction, createTimeEntryAction } from "../actions";

const arNum = (n: number) => n.toLocaleString("ar-SA");
const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, dateStyle: "medium" }).format(d);

export default async function ProfitabilityPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const [entries, profitability, canEdit] = await Promise.all([
      listTimeEntries(session),
      getCaseProfitability(session),
      canAction(session, PermModule.FINANCE, "edit"),
    ]);
    const [cases, lawyers] = canEdit ? await Promise.all([listCases(session), listAssignableUsers(session)]) : [[], []];

    content = (
      <>
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>{t("finProfit.hint")}</div>
        </div>

        {canEdit && (
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>{t("finProfit.newEntry")}</h2>
            <form action={createTimeEntryAction} className="three" style={{ alignItems: "flex-end" }}>
              <div className="field">
                <label>{t("finProfit.col.case")}</label>
                <select name="caseId" defaultValue="" required>
                  <option value="" disabled>—</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t("finProfit.col.lawyer")}</label>
                <select name="lawyerId" defaultValue="" required>
                  <option value="" disabled>—</option>
                  {lawyers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t("finProfit.col.date")}</label>
                <input type="date" name="workDate" />
              </div>
              <div className="field">
                <label>{t("finProfit.hoursInput")}</label>
                <input type="number" name="hours" min="0.1" step="0.1" required />
              </div>
              <div className="field">
                <label>{t("finProfit.hourlyRate")}</label>
                <input type="number" name="hourlyRate" min="0" step="0.01" required />
              </div>
              <div className="field">
                <label>{t("finProfit.description")}</label>
                <input type="text" name="description" />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" name="billable" defaultChecked />
                {t("finProfit.billable")}
              </label>
              <button type="submit" className="act b-add">
                {t("finProfit.addSubmit")}
              </button>
            </form>
          </div>
        )}

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
