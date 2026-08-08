import { redirect } from "next/navigation";
import { EmployeeStatus, LeaveType, PermModule } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { HrTabs } from "@/components/hr-tabs";
import { ErrBanner } from "@/components/hr-ui";
import { getSession } from "@/lib/auth/session";
import { listLeaves } from "@/server/hr/leaves";
import { listEmployees } from "@/server/hr/employees";
import { canAction, PermissionError } from "@/lib/permissions/guard";
import { leaveTypeLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";
import { createLeaveAction } from "../actions";

const fmtDate = (d: Date) => new Date(d).toISOString().slice(0, 10);

export default async function LeavesPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { err } = await searchParams;

  let content: React.ReactNode;
  try {
    const [leaves, employees] = await Promise.all([listLeaves(session), listEmployees(session)]);
    const active = employees.filter((e) => e.status !== EmployeeStatus.TERMINATED);
    const canEdit = await canAction(session, PermModule.HR, "edit");

    content = (
      <>
        {canEdit ? (
        <form action={createLeaveAction} className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
          <label className="text-sm">
            <span className="mb-1 block text-ink-soft">{t("hr.employee")}</span>
            <select name="employeeId" required className={INPUT} defaultValue="">
              <option value="" disabled>{t("hr.form.select")}</option>
              {active.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink-soft">{t("hr.col.type")}</span>
            <select name="type" defaultValue={LeaveType.ANNUAL} className={INPUT}>
              {Object.values(LeaveType).map((v) => <option key={v} value={v}>{leaveTypeLabel(v)}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink-soft">{t("hr.col.days")}</span>
            <input type="number" name="days" min={1} required className={INPUT} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink-soft">{t("hr.form.startDate")}</span>
            <input type="date" name="startDate" required className={INPUT} />
          </label>
          <label className="text-sm grow">
            <span className="mb-1 block text-ink-soft">{t("hr.form.note")}</span>
            <input type="text" name="note" className={INPUT} />
          </label>
          <button type="submit" className={BTN}>{t("hr.action.newLeave")}</button>
        </form>
        ) : null}

        {leaves.length === 0 ? (
          <p className="text-ink-soft">{t("hr.empty.leaves")}</p>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-line text-ink-soft">
                <tr>
                  <th className="p-3 font-medium">{t("hr.col.employee")}</th>
                  <th className="p-3 font-medium">{t("hr.col.type")}</th>
                  <th className="p-3 font-medium">{t("hr.col.days")}</th>
                  <th className="p-3 font-medium">{t("hr.col.date")}</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id} className="border-b border-parch-line last:border-0">
                    <td className="p-3">{l.employee.name}</td>
                    <td className="p-3">{leaveTypeLabel(l.type)}</td>
                    <td className="p-3">{l.days}</td>
                    <td className="p-3 text-ink-soft">{fmtDate(l.startDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

const INPUT = "w-full rounded-lg border border-line bg-parch px-3 py-2 text-sm";
const BTN = "rounded-lg bg-bench px-4 py-2 text-sm font-medium text-white hover:bg-bench-2";
