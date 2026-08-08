import { Fragment } from "react";
import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { FinanceTabs } from "@/components/finance-tabs";
import { ErrBanner } from "@/components/hr-ui";
import { getSession } from "@/lib/auth/session";
import { listJournal, listAccounts } from "@/server/ledger-reports";
import { canAction, PermissionError } from "@/lib/permissions/guard";
import { PermModule } from "@prisma/client";
import { formatSar } from "@/lib/money";
import { RIYADH_TZ } from "@/lib/dates";
import { t } from "@/lib/i18n";
import { createManualJournalEntryAction } from "../actions";

function formatWhen(d: Date): string {
  return new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, dateStyle: "medium" }).format(d);
}

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { err } = await searchParams;

  let content: React.ReactNode;
  try {
    const [entries, accounts, canEdit] = await Promise.all([
      listJournal(session),
      listAccounts(session),
      canAction(session, PermModule.FINANCE, "delete"),
    ]);

    content = (
      <>
        {canEdit && (
          <details className="panel">
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>{t("finJournal.newEntry")}</summary>
            <form action={createManualJournalEntryAction} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label className="field" style={{ flex: 1, minWidth: 200 }}>
                  <span>{t("finJournal.form.description")}</span>
                  <input type="text" name="description" required />
                </label>
                <label className="field" style={{ minWidth: 160 }}>
                  <span>{t("finJournal.form.date")}</span>
                  <input type="date" name="entryDate" required />
                </label>
              </div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <label className="field" style={{ flex: 1, minWidth: 160 }}>
                    <span>{t("finJournal.form.account")}</span>
                    <select name={`code${i}`} defaultValue="">
                      <option value=""></option>
                      {accounts.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field" style={{ width: 140 }}>
                    <span>{t("finJournal.form.debit")}</span>
                    <input type="number" name={`debit${i}`} min={0} step="0.01" />
                  </label>
                  <label className="field" style={{ width: 140 }}>
                    <span>{t("finJournal.form.credit")}</span>
                    <input type="number" name={`credit${i}`} min={0} step="0.01" />
                  </label>
                </div>
              ))}
              <div>
                <button type="submit" className="act b-add">{t("finJournal.form.save")}</button>
              </div>
            </form>
          </details>
        )}

        <div className="panel overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="p-3 font-medium">{t("finJournal.col.date")}</th>
                <th className="p-3 font-medium">{t("finJournal.col.description")}</th>
                <th className="p-3 font-medium">{t("finJournal.col.account")}</th>
                <th className="p-3 font-medium">{t("finJournal.col.debit")}</th>
                <th className="p-3 font-medium">{t("finJournal.col.credit")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <Fragment key={e.id}>
                  <tr className="border-b border-parch-line/50">
                    <td className="p-3 text-ink-soft" rowSpan={e.lines.length}>{formatWhen(e.entryDate)}</td>
                    <td className="p-3" rowSpan={e.lines.length}>
                      {e.entryNo} — {e.description}
                    </td>
                    <td className="p-3 text-ink-soft">{e.lines[0]?.account.code} {e.lines[0]?.account.name}</td>
                    <td className="p-3">{e.lines[0]?.debit ? formatSar(e.lines[0].debit) : "—"}</td>
                    <td className="p-3">{e.lines[0]?.credit ? formatSar(e.lines[0].credit) : "—"}</td>
                  </tr>
                  {e.lines.slice(1).map((l) => (
                    <tr key={l.id} className="border-b border-parch-line last:border-0">
                      <td className="p-3 text-ink-soft">{l.account.code} {l.account.name}</td>
                      <td className="p-3">{l.debit ? formatSar(l.debit) : "—"}</td>
                      <td className="p-3">{l.credit ? formatSar(l.credit) : "—"}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  } catch (e) {
    if (e instanceof PermissionError) content = <DeniedPanel />;
    else throw e;
  }

  return (
    <AppShell>
      <div className="vhead"><h2>{t("finance.title")}</h2></div>
      <FinanceTabs />
      <ErrBanner code={err} />
      {content}
    </AppShell>
  );
}
