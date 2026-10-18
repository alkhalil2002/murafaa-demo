import Link from "next/link";
import { authCurrent, financeListTime, financeParties, financeProfitability } from "@murafaa/sdk";
import { formatSar, t } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { InvoiceTimeButton, OfficeTimeForm } from "@/components/finance/finance-forms";
import { serverApi } from "@/lib/api";

/** ربحية القضايا + سجل الساعات (legacy profitability page). */
export default async function ProfitabilityPage() {
  const api = await serverApi();
  const [me, profRes, timeRes] = await Promise.all([
    authCurrent({ client: api }),
    financeProfitability({ client: api }),
    financeListTime({ client: api }),
  ]);
  const rows = profRes.data?.data;
  const time = timeRes.data?.data ?? [];
  if (!rows) return <DeniedPanel />;
  const level = me.data?.data.modules.FINANCE;
  const canEdit = (level === "EDIT" || level === "FULL") && !me.data?.data.user.previewRole;
  const parties = canEdit ? (await financeParties({ client: api })).data?.data : undefined;
  return (
    <>
      <div className="panel">
        <div className="sub" style={{ marginBottom: 0 }}>
          {t("finProfit.hint")}
        </div>
      </div>
      {parties && <OfficeTimeForm cases={parties.cases} staff={parties.staff} />}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("finProfit.caseProfitability")}</h2>
        {rows.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("finance.empty")}
          </div>
        ) : (
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
              {rows.map((r) => (
                <tr key={r.caseId} className="border-b border-line last:border-0">
                  <td className="p-3">
                    <Link href={`/cases/${r.caseId}?tab=finance`}>{r.caseTitle}</Link>
                  </td>
                  <td className="p-3">{formatSar(r.fees)}</td>
                  <td className="p-3">{formatSar(r.expenses)}</td>
                  <td
                    className="p-3 font-medium"
                    style={{ color: r.margin >= 0 ? "var(--ok)" : "var(--advocate)" }}
                  >
                    {formatSar(r.margin)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("finProfit.timeLog")}</h2>
        {time.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("finance.empty")}
          </div>
        ) : (
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
              {time.map((te) => (
                <tr key={te.id} className="border-b border-line last:border-0">
                  <td className="p-3">{te.caseTitle}</td>
                  <td className="p-3 text-ink-soft">{te.lawyerName}</td>
                  <td className="p-3 text-ink-soft">{te.workDate}</td>
                  <td className="p-3">
                    {(Math.round(te.minutes / 6) / 10).toLocaleString("ar-SA")}
                  </td>
                  <td className="p-3">{formatSar(te.value)}</td>
                  <td className="p-3">
                    {te.invoiced ? (
                      "✓"
                    ) : te.billable && canEdit ? (
                      <InvoiceTimeButton id={te.id} />
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
}
