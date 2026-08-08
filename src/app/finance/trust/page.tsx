import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { listTrustAccounts } from "@/server/trust";
import { PermissionError } from "@/lib/permissions/guard";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";

export default async function TrustPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const accounts = await listTrustAccounts(session);
    const total = accounts.reduce((s, a) => s + a.balanceMinor, 0);
    content =
      accounts.length === 0 ? (
        <p className="text-ink-soft">{t("finance.empty")}</p>
      ) : (
        <>
          <div className="mb-4 rounded-2xl border border-gold bg-gold/5 p-4 text-sm">
            <span className="text-ink-soft">{t("trust.totalBalance")}: </span>
            <span className="font-semibold text-bench">{formatSar(total)}</span>
            <span className="mr-2 text-xs text-ink-soft">— {t("trust.segregationNote")}</span>
          </div>
          <div className="panel overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-line text-ink-soft">
                <tr>
                  <th className="p-3 font-medium">{t("trust.client")}</th>
                  <th className="p-3 font-medium">{t("trust.balance")}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-parch-line last:border-0">
                    <td className="p-3 font-medium">{a.client.name}</td>
                    <td className="p-3">{formatSar(a.balanceMinor)}</td>
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
