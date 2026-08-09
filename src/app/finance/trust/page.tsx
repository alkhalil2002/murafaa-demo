import { redirect } from "next/navigation";
import Link from "next/link";
import { TrustTxnType } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { listTrustAccounts } from "@/server/trust";
import { listClients } from "@/server/clients";
import { PermissionError, canAction } from "@/lib/permissions/guard";
import { PermModule } from "@prisma/client";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";
import { trustDepositAction, trustWithdrawAction, trustTransferAction } from "./actions";

export default async function TrustPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const [accounts, canEdit] = await Promise.all([
      listTrustAccounts(session),
      canAction(session, PermModule.FINANCE, "edit"),
    ]);
    const clients = canEdit ? await listClients(session) : [];
    const total = accounts.reduce((s, a) => s + a.balanceMinor, 0);
    content = (
      <>
        <div className="mb-4 rounded-2xl border border-gold bg-gold/5 p-4 text-sm">
          <span className="text-ink-soft">{t("trust.totalBalance")}: </span>
          <span className="font-semibold text-bench">{formatSar(total)}</span>
          <span className="mr-2 text-xs text-ink-soft">— {t("trust.segregationNote")}</span>
        </div>
        {canEdit && (
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>{t("trust.newMovement")}</h2>
            <form
              action={trustDepositAction}
              style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, alignItems: "flex-end" }}
            >
              <div className="field">
                <label>{t("trust.client")}</label>
                <select name="clientId" defaultValue="" required>
                  <option value="" disabled>
                    {t("trust.selectClient")}
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t("trust.amount")}</label>
                <input type="number" name="amount" min="0.01" step="0.01" required />
              </div>
              <div className="field">
                <label>{t("trust.date")}</label>
                <input type="date" name="date" />
              </div>
              <div className="field">
                <label>{t("trust.note")}</label>
                <input type="text" name="note" />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="submit" className="act b-add">
                  {t(`trust.type.${TrustTxnType.DEPOSIT}` as never)}
                </button>
                <button type="submit" formAction={trustWithdrawAction} className="tinybtn">
                  {t(`trust.type.${TrustTxnType.WITHDRAWAL}` as never)}
                </button>
                <button type="submit" formAction={trustTransferAction} className="tinybtn">
                  {t(`trust.type.${TrustTxnType.TRANSFER_TO_FEES}` as never)}
                </button>
              </div>
            </form>
          </div>
        )}
        {accounts.length === 0 ? (
          <p className="text-ink-soft">{t("finance.empty")}</p>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-line text-ink-soft">
                <tr>
                  <th className="p-3 font-medium">{t("trust.client")}</th>
                  <th className="p-3 font-medium">{t("trust.balance")}</th>
                  <th className="p-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-parch-line last:border-0">
                    <td className="p-3 font-medium">{a.client.name}</td>
                    <td className="p-3">{formatSar(a.balanceMinor)}</td>
                    <td className="p-3">
                      <Link href={`/finance/trust/${a.clientId}`} className="tinybtn">
                        {t("trust.viewLedger")}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
