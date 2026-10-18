import { redirect } from "next/navigation";
import { EmployeeStatus, PermModule } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { HrTabs } from "@/components/hr-tabs";
import { ErrBanner } from "@/components/hr-ui";
import { getSession } from "@/lib/auth/session";
import { listEmployees } from "@/server/hr/employees";
import { canAction, PermissionError } from "@/lib/permissions/guard";
import { t } from "@/lib/i18n";
import { setPerformanceScoreAction } from "../actions";

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { err } = await searchParams;

  let content: React.ReactNode;
  try {
    const [employees, canEdit] = await Promise.all([
      listEmployees(session),
      canAction(session, PermModule.HR, "edit"),
    ]);
    const active = employees.filter((e) => e.status !== EmployeeStatus.TERMINATED);

    content = (
      <div className="panel overflow-x-auto">
        <div className="sub" style={{ marginBottom: 12 }}>{t("hr.perf.hint")}</div>
        <table className="w-full text-right text-sm">
          <thead className="border-b border-line text-ink-soft">
            <tr>
              <th className="p-3 font-medium">{t("hr.perf.col.employee")}</th>
              <th className="p-3 font-medium">{t("hr.jobTitle")}</th>
              <th className="p-3 font-medium">{t("hr.perf.col.score")}</th>
            </tr>
          </thead>
          <tbody>
            {active.map((e) => (
              <tr key={e.id} className="border-b border-parch-line last:border-0">
                <td className="p-3">{e.name}</td>
                <td className="p-3 text-ink-soft">{e.jobTitle ?? "—"}</td>
                <td className="p-3">
                  {canEdit ? (
                    <form action={setPerformanceScoreAction} className="flex items-center gap-2">
                      <input type="hidden" name="employeeId" value={e.id} />
                      <input
                        type="number"
                        name="performanceScore"
                        min={0}
                        max={100}
                        defaultValue={e.performanceScore ?? ""}
                        className="w-20 rounded-lg border border-line px-2 py-1"
                      />
                      <button type="submit" className="rounded-lg border border-line px-2 py-1 text-xs text-ink-soft">
                        {t("hr.perf.save")}
                      </button>
                    </form>
                  ) : (
                    <span>{e.performanceScore ?? "—"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
