import { Fragment } from "react";
import { authCurrent, financeAccounts, financeJournal } from "@murafaa/sdk";
import { formatSar, t, tStored } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { ManualJournalForm } from "@/components/finance/finance-forms";
import { serverApi } from "@/lib/api";

/** قيود اليومية, newest first, plus a manual entry for the full level (legacy journal page). */
export default async function JournalPage() {
  const api = await serverApi();
  const [me, jRes, aRes] = await Promise.all([
    authCurrent({ client: api }),
    financeJournal({ client: api }),
    financeAccounts({ client: api }),
  ]);
  const entries = jRes.data?.data;
  if (!entries) return <DeniedPanel />;
  const canPost = me.data?.data.modules.FINANCE === "FULL" && !me.data?.data.user.previewRole;
  return (
    <>
      {canPost && <ManualJournalForm accounts={aRes.data?.data ?? []} />}
      <div className="panel">
        {entries.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("finance.empty")}
          </div>
        ) : (
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
                  {e.lines.map((l, i) => (
                    <tr
                      key={`${e.id}-${i}`}
                      className={i === e.lines.length - 1 ? "border-b border-line" : ""}
                    >
                      {i === 0 && (
                        <>
                          <td className="p-3 text-ink-soft" rowSpan={e.lines.length}>
                            {e.date}
                          </td>
                          <td className="p-3" rowSpan={e.lines.length}>
                            {e.entryNo} — {tStored(e.description.messageKey, e.description.params)}
                          </td>
                        </>
                      )}
                      <td className="p-3 text-ink-soft">
                        {l.code} {l.name}
                      </td>
                      <td className="p-3">{l.debit ? formatSar(l.debit) : "—"}</td>
                      <td className="p-3">{l.credit ? formatSar(l.credit) : "—"}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
