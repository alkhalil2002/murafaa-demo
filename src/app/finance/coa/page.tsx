import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { trialBalance } from "@/server/ledger-reports";
import { PermissionError } from "@/lib/permissions/guard";
import { accountTypeLabel } from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";

export default async function ChartOfAccountsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const rows = await trialBalance(session);
    content = (
      <div className="panel overflow-x-auto">
        <div className="sub" style={{ marginBottom: 12 }}>{t("finCoa.hint")}</div>
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
            {rows.map((r) => (
              <tr key={r.code} className="border-b border-parch-line last:border-0">
                <td className="p-3 text-ink-soft">{r.code}</td>
                <td className="p-3">{r.name}</td>
                <td className="p-3 text-ink-soft">{accountTypeLabel(r.type)}</td>
                <td className="p-3">{formatSar(r.debit || r.credit)}</td>
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
      <div className="vhead"><h2>{t("finance.title")}</h2></div>
      <FinanceTabs />
      {content}
    </AppShell>
  );
}
