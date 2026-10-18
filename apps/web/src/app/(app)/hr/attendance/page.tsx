import { hrAttendanceMonth, hrAttendanceToday } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { RIYADH_TZ } from "@murafaa/rules";
import { DeniedPanel } from "@/components/denied-panel";
import { AttendanceButtons } from "@/components/hr/hr-forms";
import { hrAccess } from "@/components/hr/hr-access";
import { CELL, HrTable, ROW, SOFT } from "@/components/hr/hr-ui";
import { HrHeader } from "../hr-header";

const arNum = (n: number) => n.toLocaleString("ar-SA");
const fmtTime = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("ar-SA", {
        timeZone: RIYADH_TZ,
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso))
    : "—";

/** الحضور والانصراف (legacy /hr/attendance): today, then the month's day counts. */
export default async function AttendancePage() {
  const { api, canEdit } = await hrAccess();
  const [today, month] = await Promise.all([
    hrAttendanceToday({ client: api }),
    hrAttendanceMonth({ client: api }),
  ]);
  if (!today.data || !month.data)
    return (
      <>
        <HrHeader />
        <DeniedPanel />
      </>
    );
  const rows = today.data.data.rows;
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return (
    <>
      <HrHeader />
      <div className="kpis">
        <div className="kpi">
          <div className="v">{arNum(count("PRESENT"))}</div>
          <div className="l">{t("hr.attendance.kpi.present")}</div>
        </div>
        <div className="kpi">
          <div className="v">{arNum(count("LATE"))}</div>
          <div className="l">{t("hr.attendance.kpi.late")}</div>
        </div>
        <div className="kpi">
          <div className="v">{arNum(count("ABSENT"))}</div>
          <div className="l">{t("hr.attendance.kpi.absent")}</div>
        </div>
      </div>
      <h2 style={{ marginTop: 0 }}>{t("hr.attendance.today")}</h2>
      <HrTable
        head={[
          t("hr.attendance.col.employee"),
          t("hr.attendance.col.checkIn"),
          t("hr.attendance.col.checkOut"),
          t("hr.attendance.col.status"),
          ...(canEdit ? [t("hr.attendance.col.action")] : []),
        ]}
      >
        {rows.map((r) => (
          <tr key={r.employeeId} className={ROW}>
            <td className={CELL}>{r.employeeName}</td>
            <td className={SOFT}>{fmtTime(r.checkIn)}</td>
            <td className={SOFT}>{fmtTime(r.checkOut)}</td>
            <td className={CELL}>
              {r.status ? t(`hr.attendance.status.${r.status}` as MessageKey) : "—"}
            </td>
            {canEdit && (
              <td className={CELL}>
                <AttendanceButtons employeeId={r.employeeId} status={r.status} />
              </td>
            )}
          </tr>
        ))}
      </HrTable>
      <h2 style={{ marginTop: 0 }}>{t("hr.attendance.monthly.title")}</h2>
      <HrTable
        head={[
          t("hr.attendance.col.employee"),
          t("hr.attendance.col.daysPresent"),
          t("hr.attendance.col.lateCount"),
          t("hr.attendance.col.daysAbsent"),
        ]}
      >
        {month.data.data.rows.map((m) => (
          <tr key={m.employeeId} className={ROW}>
            <td className={CELL}>{m.employeeName}</td>
            <td className={CELL}>{arNum(m.daysPresent)}</td>
            <td className={CELL}>{arNum(m.lateCount)}</td>
            <td className={CELL}>{arNum(m.daysAbsent)}</td>
          </tr>
        ))}
      </HrTable>
    </>
  );
}
