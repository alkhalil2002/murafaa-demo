import Link from "next/link";
import { hrPayrollRuns } from "@murafaa/sdk";
import { formatSar, t } from "@murafaa/i18n";
import { riyadhCalendarDate } from "@murafaa/rules";
import { DeniedPanel } from "@/components/denied-panel";
import { RunPayrollForm } from "@/components/hr/hr-forms";
import { hrAccess } from "@/components/hr/hr-access";
import { CELL, HrTable, ROW, SOFT } from "@/components/hr/hr-ui";
import { HrHeader } from "../hr-header";

/** مسيّر الرواتب (legacy /hr/payroll). */
export default async function PayrollPage() {
  const { api, canEdit } = await hrAccess();
  const runs = (await hrPayrollRuns({ client: api })).data?.data;
  const today = riyadhCalendarDate();
  return (
    <>
      <HrHeader />
      {!runs ? (
        <DeniedPanel />
      ) : (
        <>
          {canEdit && (
            <RunPayrollForm year={today.getUTCFullYear()} month={today.getUTCMonth() + 1} />
          )}
          {runs.length === 0 ? (
            <p className="text-ink-soft">{t("hr.empty.payroll")}</p>
          ) : (
            <HrTable
              head={[
                t("hr.col.period"),
                t("hr.col.employee"),
                t("hr.gross"),
                t("hr.gosi"),
                t("hr.advances"),
                t("hr.net"),
              ]}
            >
              {runs.map((r) => (
                <tr key={r.id} className={`${ROW} hover:bg-parch`}>
                  <td className={CELL}>
                    <Link href={`/hr/payroll/${r.id}`} className="text-bench hover:underline">
                      {r.periodKey}
                    </Link>
                  </td>
                  <td className={SOFT}>{r.lineCount.toLocaleString("ar-SA")}</td>
                  <td className={CELL}>{formatSar(r.totalBasic + r.totalAllowances)}</td>
                  <td className={SOFT}>{formatSar(r.totalGosi)}</td>
                  <td className={SOFT}>{formatSar(r.totalAdvances)}</td>
                  <td className={CELL}>{formatSar(r.totalNet)}</td>
                </tr>
              ))}
            </HrTable>
          )}
        </>
      )}
    </>
  );
}
