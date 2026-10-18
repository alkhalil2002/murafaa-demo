import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { TrustTxnType } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { getTrustLedger } from "@/server/trust";
import { PermissionError, canAction } from "@/lib/permissions/guard";
import { PermModule } from "@prisma/client";
import { formatSar } from "@/lib/money";
import { RIYADH_TZ } from "@/lib/dates";
import { t } from "@/lib/i18n";
import { trustDepositAction, trustWithdrawAction, trustTransferAction } from "../actions";

const fmtDate = (d: Date) => new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, dateStyle: "medium" }).format(d);

export default async function TrustLedgerPage({ params }: { params: Promise<{ clientId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { clientId } = await params;

  let content: React.ReactNode;
  try {
    const [account, canEdit] = await Promise.all([
      getTrustLedger(session, clientId),
      canAction(session, PermModule.FINANCE, "edit"),
    ]);
    if (!account) notFound();

    let running = 0;
    const rows = [...account.transactions].sort((a, b) => a.date.getTime() - b.date.getTime());

    content = (
      <>
        {canEdit && (
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>{t("trust.newMovement")}</h2>
            <form
              action={trustDepositAction}
              style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, alignItems: "flex-end" }}
            >
              <input type="hidden" name="clientId" value={clientId} />
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
              <div style={{ display: "flex", gap: 6, gridColumn: "span 3" }}>
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
        <div className="panel overflow-x-auto">
          <h2 style={{ marginTop: 0 }}>
            {t("trust.ledgerTitle")} — {account.client.name}
          </h2>
          {rows.length === 0 ? (
            <p className="text-ink-soft">{t("trust.noTransactions")}</p>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="border-b border-line text-ink-soft">
                <tr>
                  <th className="p-3 font-medium">{t("trust.date")}</th>
                  <th className="p-3 font-medium">{t("trust.type")}</th>
                  <th className="p-3 font-medium">{t("trust.amount")}</th>
                  <th className="p-3 font-medium">{t("trust.runningBalance")}</th>
                  <th className="p-3 font-medium">{t("trust.note")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((txn) => {
                  const isDeposit = txn.type === TrustTxnType.DEPOSIT;
                  running += isDeposit ? txn.amountMinor : -txn.amountMinor;
                  return (
                    <tr key={txn.id} className="border-b border-parch-line last:border-0">
                      <td className="p-3 text-ink-soft">{fmtDate(txn.date)}</td>
                      <td className="p-3">
                        <span className="chip" style={{ color: isDeposit ? "var(--ok)" : "var(--gold)" }}>
                          {t(`trust.type.${txn.type}` as never)}
                        </span>
                      </td>
                      <td className="p-3" style={{ color: isDeposit ? "var(--ok)" : "var(--gold)" }}>
                        {isDeposit ? "+" : "−"}
                        {formatSar(txn.amountMinor)}
                      </td>
                      <td className="p-3 font-medium">{formatSar(running)}</td>
                      <td className="p-3 text-ink-soft">{txn.note ?? "—"}</td>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 700, background: "var(--parch)" }}>
                  <td className="p-3" colSpan={3}>
                    {t("trust.balance")}
                  </td>
                  <td className="p-3">{formatSar(account.balanceMinor)}</td>
                  <td className="p-3" />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("finance.title")}</h2>
      </div>
      <FinanceTabs />
      <div style={{ marginBottom: 12 }}>
        <Link href="/finance/trust" className="mini">
          {t("trust.back")}
        </Link>
      </div>
      {content}
    </AppShell>
  );
}
