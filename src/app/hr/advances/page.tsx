import { redirect } from "next/navigation";
import { EmployeeStatus, PermModule } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { HrTabs } from "@/components/hr-tabs";
import { ErrBanner, Pill } from "@/components/hr-ui";
import { getSession } from "@/lib/auth/session";
import { listAdvances } from "@/server/hr/advances";
import { listEmployees } from "@/server/hr/employees";
import { canAction, PermissionError } from "@/lib/permissions/guard";
import { advanceStatusLabel } from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";
import { createAdvanceAction } from "../actions";

export default async function AdvancesPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { err } = await searchParams;

  let content: React.ReactNode;
  try {
    const [advances, employees] = await Promise.all([listAdvances(session), listEmployees(session)]);
    const active = employees.filter((e) => e.status !== EmployeeStatus.TERMINATED);
    const canEdit = await canAction(session, PermModule.HR, "edit");

    content = (
      <>
        {canEdit ? (
        <form action={createAdvanceAction} className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
          <label className="text-sm">
            <span className="mb-1 block text-ink-soft">{t("hr.employee")}</span>
            <select name="employeeId" required className={INPUT} defaultValue="">
              <option value="" disabled>{t("hr.form.select")}</option>
              {active.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink-soft">{t("hr.form.amountSar")}</span>
            <input type="number" name="amount" min={1} step={0.01} required className={INPUT} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink-soft">{t("hr.form.months")}</span>
            <input type="number" name="months" min={1} defaultValue={1} required className={INPUT} />
          </label>
          <label className="text-sm grow">
            <span className="mb-1 block text-ink-soft">{t("hr.form.note")}</span>
            <input type="text" name="note" className={INPUT} />
          </label>
          <button type="submit" className={BTN}>{t("hr.action.newAdvance")}</button>
        </form>
        ) : null}

        {advances.length === 0 ? (
          <p className="text-ink-soft">{t("hr.empty.advances")}</p>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-line text-ink-soft">
                <tr>
                  <th className="p-3 font-medium">{t("hr.col.employee")}</th>
                  <th className="p-3 font-medium">{t("hr.col.amount")}</th>
                  <th className="p-3 font-medium">{t("hr.advance.monthly")}</th>
                  <th className="p-3 font-medium">{t("hr.advance.remaining")}</th>
                  <th className="p-3 font-medium">{t("hr.col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {advances.map((a) => (
                  <tr key={a.id} className="border-b border-parch-line last:border-0">
                    <td className="p-3">{a.employee.name}</td>
                    <td className="p-3">{formatSar(a.amount)}</td>
                    <td className="p-3 text-ink-soft">{formatSar(a.monthlyDue)}</td>
                    <td className="p-3">{formatSar(a.remaining)}</td>
                    <td className="p-3">
                      <Pill tone={a.status === "SETTLED" ? "ok" : a.status === "CANCELLED" ? "muted" : "gold"}>
                        {advanceStatusLabel(a.status)}
                      </Pill>
                    </td>
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
