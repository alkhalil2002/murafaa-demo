import Link from "next/link";
import { authCurrent, financeListExpenses, financeParties } from "@murafaa/sdk";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { ExpenseForm, ReimburseButton } from "@/components/finance/finance-forms";
import { serverApi } from "@/lib/api";

/** المصروفات (legacy expenses page + the prototype's add-expense form). */
export default async function ExpensesPage() {
  const api = await serverApi();
  const [me, res] = await Promise.all([
    authCurrent({ client: api }),
    financeListExpenses({ client: api }),
  ]);
  const list = res.data?.data;
  if (!list) return <DeniedPanel />;
  const level = me.data?.data.modules.FINANCE;
  const canEdit = (level === "EDIT" || level === "FULL") && !me.data?.data.user.previewRole;
  const parties = canEdit ? (await financeParties({ client: api })).data?.data : undefined;
  return (
    <>
      {parties && <ExpenseForm clients={parties.clients} cases={parties.cases} />}
      {list.length === 0 ? (
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("finance.empty")}
          </div>
        </div>
      ) : (
        <div className="panel">
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
              {list.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="p-3">
                    {t(`expCat.${e.category}` as MessageKey)}
                    {!e.approved && (
                      <span
                        className="chip"
                        style={{ color: "var(--amber-600)", borderColor: "var(--amber-400)" }}
                      >
                        {" "}
                        {t("exp.pendingApproval")}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-ink-soft">
                    {e.vendor ?? "—"}
                    {e.caseId && (
                      <Link href={`/cases/${e.caseId}?tab=finance`} className="chip">
                        {" "}
                        ⚖ {e.caseTitle}
                      </Link>
                    )}
                  </td>
                  <td className="p-3">{formatSar(e.net)}</td>
                  <td className="p-3 text-ink-soft">{formatSar(e.inputVat)}</td>
                  <td className="p-3 text-ink-soft">{e.date}</td>
                  <td className="p-3">
                    {e.billed ? (
                      <span
                        className="chip"
                        style={{ color: "var(--ok)", borderColor: "var(--ok)" }}
                      >
                        ✓ {t("exp.billed")}
                      </span>
                    ) : e.billable && e.clientId && canEdit ? (
                      <ReimburseButton id={e.id} />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
