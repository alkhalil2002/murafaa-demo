import Link from "next/link";
import { redirect } from "next/navigation";
import { PermModule } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { HrTabs } from "@/components/hr-tabs";
import { ErrBanner } from "@/components/hr-ui";
import { getSession } from "@/lib/auth/session";
import { listPayrollRuns } from "@/server/hr/payroll";
import { canAction, PermissionError } from "@/lib/permissions/guard";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";
import { runPayrollAction } from "../actions";

const MONTHS = ["١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩", "١٠", "١١", "١٢"];

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { err } = await searchParams;

  let content: React.ReactNode;
  try {
    const runs = await listPayrollRuns(session);
    const canEdit = await canAction(session, PermModule.HR, "edit");
    content = (
      <>
        {canEdit ? (
        <form action={runPayrollAction} className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
          <label className="text-sm">
            <span className="mb-1 block text-ink-soft">{t("hr.form.year")}</span>
            <input type="number" name="year" defaultValue={2026} min={2000} max={2100} required className={INPUT} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink-soft">{t("hr.form.month")}</span>
            <select name="month" defaultValue={7} className={INPUT}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <button type="submit" className={BTN}>{t("hr.action.runPayroll")}</button>
        </form>
        ) : null}

        {runs.length === 0 ? (
          <p className="text-ink-soft">{t("hr.empty.payroll")}</p>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-line text-ink-soft">
                <tr>
                  <th className="p-3 font-medium">{t("hr.col.period")}</th>
                  <th className="p-3 font-medium">{t("hr.col.employee")}</th>
                  <th className="p-3 font-medium">{t("hr.gross")}</th>
                  <th className="p-3 font-medium">{t("hr.gosi")}</th>
                  <th className="p-3 font-medium">{t("hr.advances")}</th>
                  <th className="p-3 font-medium">{t("hr.net")}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-parch-line last:border-0 hover:bg-parch">
                    <td className="p-3">
                      <Link href={`/hr/payroll/${r.id}`} className="text-bench hover:underline">{r.periodKey}</Link>
                    </td>
                    <td className="p-3 text-ink-soft">{r._count.lines}</td>
                    <td className="p-3">{formatSar(r.totalBasic + r.totalAllowances)}</td>
                    <td className="p-3 text-ink-soft">{formatSar(r.totalGosi)}</td>
                    <td className="p-3 text-ink-soft">{formatSar(r.totalAdvances)}</td>
                    <td className="p-3">{formatSar(r.totalNet)}</td>
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
