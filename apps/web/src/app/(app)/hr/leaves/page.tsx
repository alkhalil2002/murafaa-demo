import { hrEmployees, hrLeaves } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { LeaveForm } from "@/components/hr/hr-forms";
import { hrAccess } from "@/components/hr/hr-access";
import { CELL, HrTable, ROW, SOFT } from "@/components/hr/hr-ui";
import { HrHeader } from "../hr-header";

/** الإجازات (legacy /hr/leaves). */
export default async function LeavesPage() {
  const { api, canEdit } = await hrAccess();
  const [leaves, employees] = await Promise.all([
    hrLeaves({ client: api }),
    hrEmployees({ client: api }),
  ]);
  const rows = leaves.data?.data;
  if (!rows || !employees.data)
    return (
      <>
        <HrHeader />
        <DeniedPanel />
      </>
    );
  const working = employees.data.data.filter((e) => e.status !== "TERMINATED");
  return (
    <>
      <HrHeader />
      {canEdit && <LeaveForm employees={working} />}
      {rows.length === 0 ? (
        <p className="text-ink-soft">{t("hr.empty.leaves")}</p>
      ) : (
        <HrTable
          head={[t("hr.col.employee"), t("hr.col.type"), t("hr.col.days"), t("hr.col.date")]}
        >
          {rows.map((l) => (
            <tr key={l.id} className={ROW}>
              <td className={CELL}>{l.employeeName}</td>
              <td className={CELL}>{t(`leaveType.${l.type}` as MessageKey)}</td>
              <td className={CELL}>{l.days.toLocaleString("ar-SA")}</td>
              <td className={SOFT}>{l.startDate}</td>
            </tr>
          ))}
        </HrTable>
      )}
    </>
  );
}
