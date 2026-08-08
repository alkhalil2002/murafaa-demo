import { redirect } from "next/navigation";
import { AttendanceStatus, PermModule } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { HrTabs } from "@/components/hr-tabs";
import { ErrBanner } from "@/components/hr-ui";
import { getSession } from "@/lib/auth/session";
import { getTodayAttendance, getMonthlySummary } from "@/server/hr/attendance";
import { canAction, PermissionError } from "@/lib/permissions/guard";
import { RIYADH_TZ } from "@/lib/dates";
import { t, type MessageKey } from "@/lib/i18n";
import { setTodayStatusAction, clockOutAction } from "../actions";

const arNum = (n: number) => n.toLocaleString("ar-SA");
const fmtTime = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("ar-SA", { timeZone: RIYADH_TZ, hour: "2-digit", minute: "2-digit" }).format(d) : "—";

const STATUS_ORDER: AttendanceStatus[] = [
  AttendanceStatus.PRESENT,
  AttendanceStatus.LATE,
  AttendanceStatus.ABSENT,
];

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { err } = await searchParams;

  let content: React.ReactNode;
  try {
    const [today, monthly] = await Promise.all([getTodayAttendance(session), getMonthlySummary(session)]);
    const canEdit = await canAction(session, PermModule.HR, "edit");

    const present = today.filter((r) => r.status === AttendanceStatus.PRESENT).length;
    const late = today.filter((r) => r.status === AttendanceStatus.LATE).length;
    const absent = today.filter((r) => r.status === AttendanceStatus.ABSENT).length;

    content = (
      <>
        <div className="kpis">
          <div className="kpi"><div className="v">{arNum(present)}</div><div className="l">{t("hr.attendance.kpi.present")}</div></div>
          <div className="kpi"><div className="v">{arNum(late)}</div><div className="l">{t("hr.attendance.kpi.late")}</div></div>
          <div className="kpi"><div className="v">{arNum(absent)}</div><div className="l">{t("hr.attendance.kpi.absent")}</div></div>
        </div>

        <div className="panel overflow-x-auto">
          <h2 style={{ marginTop: 0 }}>{t("hr.attendance.today")}</h2>
          <table className="w-full text-right text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="p-3 font-medium">{t("hr.attendance.col.employee")}</th>
                <th className="p-3 font-medium">{t("hr.attendance.col.checkIn")}</th>
                <th className="p-3 font-medium">{t("hr.attendance.col.checkOut")}</th>
                <th className="p-3 font-medium">{t("hr.attendance.col.status")}</th>
                {canEdit && <th className="p-3 font-medium">{t("hr.attendance.col.action")}</th>}
              </tr>
            </thead>
            <tbody>
              {today.map((r) => (
                <tr key={r.employeeId} className="border-b border-parch-line last:border-0">
                  <td className="p-3">{r.employeeName}</td>
                  <td className="p-3 text-ink-soft">{fmtTime(r.checkIn)}</td>
                  <td className="p-3 text-ink-soft">{fmtTime(r.checkOut)}</td>
                  <td className="p-3">{r.status ? t(`hr.attendance.status.${r.status}` as MessageKey) : "—"}</td>
                  {canEdit && (
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_ORDER.map((s) => (
                          <form action={setTodayStatusAction} key={s}>
                            <input type="hidden" name="employeeId" value={r.employeeId} />
                            <input type="hidden" name="status" value={s} />
                            <button
                              type="submit"
                              className={`rounded-lg border px-2 py-1 text-xs ${r.status === s ? "border-bench bg-bench/10 text-bench" : "border-line text-ink-soft"}`}
                            >
                              {t(`hr.attendance.status.${s}` as MessageKey)}
                            </button>
                          </form>
                        ))}
                        <form action={clockOutAction}>
                          <input type="hidden" name="employeeId" value={r.employeeId} />
                          <button type="submit" className="rounded-lg border border-line px-2 py-1 text-xs text-ink-soft">
                            {t("hr.attendance.clockOut")}
                          </button>
                        </form>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel overflow-x-auto">
          <h2 style={{ marginTop: 0 }}>{t("hr.attendance.monthly.title")}</h2>
          <table className="w-full text-right text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th className="p-3 font-medium">{t("hr.attendance.col.employee")}</th>
                <th className="p-3 font-medium">{t("hr.attendance.col.daysPresent")}</th>
                <th className="p-3 font-medium">{t("hr.attendance.col.lateCount")}</th>
                <th className="p-3 font-medium">{t("hr.attendance.col.daysAbsent")}</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((m) => (
                <tr key={m.employeeId} className="border-b border-parch-line last:border-0">
                  <td className="p-3">{m.employeeName}</td>
                  <td className="p-3">{arNum(m.daysPresent)}</td>
                  <td className="p-3">{arNum(m.lateCount)}</td>
                  <td className="p-3">{arNum(m.daysAbsent)}</td>
                </tr>
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
      <div className="vhead"><h2>{t("hr.title")}</h2></div>
      <HrTabs />
      <ErrBanner code={err} />
      {content}
    </AppShell>
  );
}
