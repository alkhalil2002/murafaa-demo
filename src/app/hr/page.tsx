import Link from "next/link";
import { redirect } from "next/navigation";
import { AdvanceStatus, EmployeeStatus, PermModule } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { HrTabs } from "@/components/hr-tabs";
import { ErrBanner, Pill, StatCard } from "@/components/hr-ui";
import { getSession } from "@/lib/auth/session";
import { listEmployees } from "@/server/hr/employees";
import { listAdvances } from "@/server/hr/advances";
import { getSaudizationStatus } from "@/server/hr/saudization";
import { canAction, PermissionError } from "@/lib/permissions/guard";
import { employeeStatusLabel, nitaqatBandLabel } from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";
import { createEmployeeAction } from "./actions";

const STATUS_TONE = {
  [EmployeeStatus.ACTIVE]: "ok",
  [EmployeeStatus.ON_LEAVE]: "gold",
  [EmployeeStatus.SUSPENDED]: "warn",
  [EmployeeStatus.TERMINATED]: "muted",
} as const;

export default async function HrPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { err } = await searchParams;

  let content: React.ReactNode;
  try {
    const [employees, advances, sz] = await Promise.all([
      listEmployees(session),
      listAdvances(session),
      getSaudizationStatus(session),
    ]);
    const activeAdvances = advances.filter((a) => a.status === AdvanceStatus.ACTIVE);
    const advancesRemaining = activeAdvances.reduce((s, a) => s + a.remaining, 0);
    const canEdit = await canAction(session, PermModule.HR, "edit");

    content = (
      <>
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label={t("hr.kpi.staff")} value={String(employees.length)} />
          <StatCard
            label={t("hr.kpi.saudization")}
            value={`${Math.round(sz.pct)}%`}
            hint={nitaqatBandLabel(sz.band)}
          />
          <StatCard
            label={t("hr.kpi.activeAdvances")}
            value={String(activeAdvances.length)}
            hint={formatSar(advancesRemaining)}
          />
        </div>

        {employees.length === 0 ? (
          <p className="text-ink-soft">{t("hr.empty.employees")}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-line text-ink-soft">
                <tr>
                  <th className="p-3 font-medium">{t("hr.col.name")}</th>
                  <th className="p-3 font-medium">{t("hr.department")}</th>
                  <th className="p-3 font-medium">{t("hr.nationality")}</th>
                  <th className="p-3 font-medium">{t("hr.basicSalary")}</th>
                  <th className="p-3 font-medium">{t("hr.allowances")}</th>
                  <th className="p-3 font-medium">{t("hr.col.status")}</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} className="border-b border-parch-line last:border-0 hover:bg-parch">
                    <td className="p-3">
                      <Link href={`/hr/${e.id}`} className="text-bench hover:underline">
                        {e.name}
                      </Link>
                      {e.jobTitle ? <div className="text-xs text-ink-soft">{e.jobTitle}</div> : null}
                    </td>
                    <td className="p-3 text-ink-soft">{e.department ?? "—"}</td>
                    <td className="p-3">{e.nationality}</td>
                    <td className="p-3">{formatSar(e.basicSalary)}</td>
                    <td className="p-3 text-ink-soft">{formatSar(e.allowances)}</td>
                    <td className="p-3">
                      <Pill tone={STATUS_TONE[e.status]}>{employeeStatusLabel(e.status)}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canEdit ? (
        <details className="mt-6 rounded-2xl border border-line bg-white p-5">
          <summary className="cursor-pointer font-serif text-lg text-bench">{t("hr.action.newEmployee")}</summary>
          <form action={createEmployeeAction} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            <TextField name="name" label={t("hr.col.name")} required />
            <TextField name="department" label={t("hr.department")} />
            <TextField name="jobTitle" label={t("hr.jobTitle")} />
            <TextField name="nationality" label={t("hr.nationality")} defaultValue="سعودي" />
            <TextField name="nationalId" label={t("hr.form.nationalId")} />
            <TextField name="iban" label="IBAN" />
            <NumField name="basicSalary" label={t("hr.form.basicSalarySar")} required />
            <NumField name="allowances" label={t("hr.form.allowancesSar")} />
            <NumField name="gosiContribution" label={t("hr.form.gosiSar")} />
            <NumField name="leaveBalanceDays" label={t("hr.leaveBalance")} />
            <label className="text-sm">
              <span className="mb-1 block text-ink-soft">{t("hr.hireDate")}</span>
              <input type="date" name="hireDate" required className={INPUT} />
            </label>
            <div className="flex items-end">
              <button type="submit" className={BTN}>{t("hr.action.save")}</button>
            </div>
          </form>
        </details>
        ) : null}
      </>
    );
  } catch (e) {
    if (e instanceof PermissionError) content = <DeniedPanel />;
    else throw e;
  }

  return (
    <AppShell>
      <h1 className="mb-4 font-serif text-3xl text-bench">{t("hr.title")}</h1>
      <HrTabs />
      <ErrBanner code={err} />
      {content}
    </AppShell>
  );
}

const INPUT = "w-full rounded-lg border border-line bg-parch px-3 py-2 text-sm";
const BTN = "rounded-lg bg-bench px-4 py-2 text-sm font-medium text-white hover:bg-bench-2";

function TextField({ name, label, required, defaultValue, placeholder }: {
  name: string; label: string; required?: boolean; defaultValue?: string; placeholder?: string;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-ink-soft">{label}</span>
      <input type="text" name={name} required={required} defaultValue={defaultValue} placeholder={placeholder} className={INPUT} />
    </label>
  );
}

function NumField({ name, label, required }: { name: string; label: string; required?: boolean }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-ink-soft">{label}</span>
      <input type="number" name={name} min={0} step={name === "leaveBalanceDays" ? 1 : 0.01} required={required} className={INPUT} />
    </label>
  );
}
