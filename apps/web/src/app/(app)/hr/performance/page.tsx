import { hrEmployees } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { PerformanceScoreForm } from "@/components/hr/hr-forms";
import { hrAccess } from "@/components/hr/hr-access";
import { CELL, HrTable, ROW, SOFT } from "@/components/hr/hr-ui";
import { HrHeader } from "../hr-header";

/** تقييم الأداء (legacy /hr/performance): the current score per employee. */
export default async function PerformancePage() {
  const { api, canEdit } = await hrAccess();
  const list = (await hrEmployees({ client: api })).data?.data;
  if (!list)
    return (
      <>
        <HrHeader />
        <DeniedPanel />
      </>
    );
  return (
    <>
      <HrHeader />
      <div className="sub" style={{ marginBottom: 12 }}>
        {t("hr.perf.hint")}
      </div>
      <HrTable head={[t("hr.perf.col.employee"), t("hr.jobTitle"), t("hr.perf.col.score")]}>
        {list
          .filter((e) => e.status !== "TERMINATED")
          .map((e) => (
            <tr key={e.id} className={ROW}>
              <td className={CELL}>{e.name}</td>
              <td className={SOFT}>{e.jobTitle ?? "—"}</td>
              <td className={CELL}>
                {canEdit ? (
                  <PerformanceScoreForm employeeId={e.id} score={e.performanceScore} />
                ) : (
                  <span>{e.performanceScore?.toLocaleString("ar-SA") ?? "—"}</span>
                )}
              </td>
            </tr>
          ))}
      </HrTable>
    </>
  );
}
