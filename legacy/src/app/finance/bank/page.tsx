import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { getSession } from "@/lib/auth/session";
import { getBankSummary, getBankLedger, BANK_ACCOUNTS, type BankAccountKey } from "@/server/finance-bank";
import { PermissionError, canAction } from "@/lib/permissions/guard";
import { PermModule } from "@prisma/client";
import { formatSar } from "@/lib/money";
import { RIYADH_TZ } from "@/lib/dates";
import { t } from "@/lib/i18n";
import { toggleBankLineClearedAction } from "../actions";

const fmtDate = (d: Date) => new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, dateStyle: "medium" }).format(d);

const ACCOUNT_LABEL: Record<BankAccountKey, string> = {
  CURRENT: "finBank.account.current",
  CASH: "finBank.account.cash",
  CHEQUE: "finBank.account.cheques",
};

function Account({ title, inflow, outflow }: { title: string; inflow: number; outflow: number }) {
  const net = inflow - outflow;
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div className="kpis">
        <div className="kpi"><div className="v">{formatSar(inflow)}</div><div className="l">{t("finBank.inflow")}</div></div>
        <div className="kpi"><div className="v">{formatSar(outflow)}</div><div className="l">{t("finBank.outflow")}</div></div>
        <div className="kpi"><div className="v" style={{ color: net >= 0 ? "var(--ok)" : "var(--advocate)" }}>{formatSar(net)}</div><div className="l">{t("finBank.balance")}</div></div>
      </div>
    </div>
  );
}

export default async function BankPage({ searchParams }: { searchParams: Promise<{ acc?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { acc } = await searchParams;
  const account: BankAccountKey = (BANK_ACCOUNTS as readonly string[]).includes(acc ?? "")
    ? (acc as BankAccountKey)
    : "CURRENT";

  let content: React.ReactNode;
  try {
    const [s, canEdit, ledger] = await Promise.all([
      getBankSummary(session),
      canAction(session, PermModule.FINANCE, "edit"),
      getBankLedger(session, account),
    ]);

    let bookBalance = 0;
    let clearedBalance = 0;
    let unclearedCount = 0;
    for (const row of ledger) {
      bookBalance += row.amountMinor;
      if (row.cleared) clearedBalance += row.amountMinor;
      else unclearedCount += 1;
    }

    content = (
      <>
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>{t("finBank.hint")}</div>
        </div>
        <Account title={t("finBank.account.current")} inflow={s.currentAccount.inflowMinor} outflow={s.currentAccount.outflowMinor} />
        <Account title={t("finBank.account.cash")} inflow={s.cash.inflowMinor} outflow={s.cash.outflowMinor} />
        <Account title={t("finBank.account.cheques")} inflow={s.cheques.inflowMinor} outflow={s.cheques.outflowMinor} />
        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("finBank.account.trust")}</h2>
          <div className="kpis">
            <div className="kpi"><div className="v">{formatSar(s.trustBalanceMinor)}</div><div className="l">{t("finBank.balance")}</div></div>
          </div>
        </div>

        <div className="panel overflow-x-auto">
          <h2 style={{ marginTop: 0 }}>{t("finBank.reconTitle")}</h2>
          <form method="GET" style={{ marginBottom: 16 }}>
            <div className="field" style={{ maxWidth: 300 }}>
              <label>{t("finBank.selectAccount")}</label>
              <select name="acc" defaultValue={account}>
                {BANK_ACCOUNTS.map((a) => (
                  <option key={a} value={a}>
                    {t(ACCOUNT_LABEL[a] as never)}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="tinybtn" style={{ marginTop: 6 }}>
              {t("common.save")}
            </button>
          </form>

          <div className="kpis" style={{ marginBottom: 16 }}>
            <div className="kpi">
              <div className="v">{formatSar(bookBalance)}</div>
              <div className="l">{t("finBank.bookBalance")}</div>
            </div>
            <div className="kpi">
              <div className="v">{formatSar(clearedBalance)}</div>
              <div className="l">{t("finBank.clearedBalance")}</div>
            </div>
            <div className="kpi">
              <div className="v">{unclearedCount.toLocaleString("ar-SA")}</div>
              <div className="l">{t("finBank.uncleared")}</div>
            </div>
          </div>

          {ledger.length === 0 ? (
            <p className="text-ink-soft">{t("finBank.empty")}</p>
          ) : (
            <table className="w-full text-right text-sm">
              <thead className="border-b border-line text-ink-soft">
                <tr>
                  <th className="p-3 font-medium">{t("finBank.col.date")}</th>
                  <th className="p-3 font-medium">{t("finBank.col.description")}</th>
                  <th className="p-3 font-medium">{t("finBank.col.amount")}</th>
                  <th className="p-3 font-medium">{t("finBank.col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="border-b border-parch-line last:border-0">
                    <td className="p-3 text-ink-soft">{fmtDate(row.date)}</td>
                    <td className="p-3">{row.description}</td>
                    <td className="p-3" style={{ color: row.amountMinor >= 0 ? "var(--ok)" : "var(--advocate)" }}>
                      {formatSar(row.amountMinor)}
                    </td>
                    <td className="p-3">
                      {canEdit ? (
                        <form action={toggleBankLineClearedAction} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input type="hidden" name="kind" value={row.kind} />
                          <input type="hidden" name="id" value={row.id} />
                          {row.cleared && (
                            <span className="chip" style={{ color: "var(--ok)" }}>
                              {t("finBank.cleared")}
                            </span>
                          )}
                          <button type="submit" className="tinybtn">
                            {row.cleared ? t("finBank.markUncleared") : t("finBank.markCleared")}
                          </button>
                        </form>
                      ) : row.cleared ? (
                        <span className="chip" style={{ color: "var(--ok)" }}>
                          {t("finBank.cleared")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
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
      <div className="vhead"><h2>{t("finance.title")}</h2></div>
      <FinanceTabs />
      {content}
    </AppShell>
  );
}
