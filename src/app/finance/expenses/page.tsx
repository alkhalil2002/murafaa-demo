import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { listExpenses } from "@/server/expenses";
import { PermissionError } from "@/lib/permissions/guard";
import { expenseCategoryLabel } from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";
import { reimburseExpenseAction } from "../actions";

export default async function ExpensesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const expenses = await listExpenses(session);
    content =
      expenses.length === 0 ? (
        <p className="text-ink-soft">{t("finance.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="p-3 font-medium">{t("exp.category")}</th>
                <th className="p-3 font-medium">{t("exp.vendor")}</th>
                <th className="p-3 font-medium">{t("inv.net")}</th>
                <th className="p-3 font-medium">{t("inv.vat")}</th>
                <th className="p-3 font-medium">{t("inv.date")}</th>
                <th className="p-3 font-medium">{t("exp.billable")}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-parch-line last:border-0">
                  <td className="p-3">{expenseCategoryLabel(e.category)}</td>
                  <td className="p-3 text-ink-soft">{e.vendor ?? "—"}</td>
                  <td className="p-3">{formatSar(e.netAmount)}</td>
                  <td className="p-3 text-ink-soft">{formatSar(e.inputVat)}</td>
                  <td className="p-3 text-ink-soft">{new Date(e.expenseDate).toISOString().slice(0, 10)}</td>
                  <td className="p-3">
                    {e.billable && !e.billed && e.clientId ? (
                      <form action={reimburseExpenseAction}>
                        <input type="hidden" name="expenseId" value={e.id} />
                        <button type="submit" className="rounded-lg border border-line px-2.5 py-1 text-xs hover:bg-parch">
                          {t("exp.reimburse")}
                        </button>
                      </form>
                    ) : e.billed ? (
                      <span className="text-xs text-ok">✓</span>
                    ) : (
                      <span className="text-xs text-ink-soft">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <h1 className="mb-4 font-serif text-3xl text-bench">{t("finance.title")}</h1>
      <FinanceTabs />
      {content}
    </AppShell>
  );
}
