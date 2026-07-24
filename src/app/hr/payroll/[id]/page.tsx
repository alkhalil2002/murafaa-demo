import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { Pill } from "@/components/hr-ui";
import { getSession } from "@/lib/auth/session";
import { getPayrollRun } from "@/server/hr/payroll";
import { generateWpsFile } from "@/server/hr/wps";
import { PermissionError } from "@/lib/permissions/guard";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";

export default async function PayrollRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ wps?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const { wps } = await searchParams;

  let content: React.ReactNode;
  try {
    const run = await getPayrollRun(session, id);
    const wpsFile = wps === "1" ? await generateWpsFile(session, id) : null;

    content = (
      <>
        <Link href="/hr/payroll" className="text-sm text-ink-soft hover:underline">→ {t("hr.tab.payroll")}</Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="font-serif text-3xl text-bench">{run.periodKey}</h1>
          <Pill tone="ok">{t("hr.payroll.posted")}</Pill>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 rounded-2xl border border-line bg-white p-5 text-sm md:grid-cols-5">
          <Field label={t("hr.gross")} value={formatSar(run.totalBasic + run.totalAllowances)} />
          <Field label={t("hr.gosi")} value={formatSar(run.totalGosi)} />
          <Field label={t("hr.advances")} value={formatSar(run.totalAdvances)} />
          <Field label={t("hr.net")} value={formatSar(run.totalNet)} />
          <Field label={t("hr.col.employee")} value={String(run.lines.length)} />
        </div>

        <section className="mt-6">
          <h2 className="mb-3 font-serif text-xl text-bench">{t("hr.tab.payroll")}</h2>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-line text-ink-soft">
                <tr>
                  <th className="p-3 font-medium">{t("hr.col.employee")}</th>
                  <th className="p-3 font-medium">{t("hr.basicSalary")}</th>
                  <th className="p-3 font-medium">{t("hr.allowances")}</th>
                  <th className="p-3 font-medium">{t("hr.gosi")}</th>
                  <th className="p-3 font-medium">{t("hr.advance.monthly")}</th>
                  <th className="p-3 font-medium">{t("hr.net")}</th>
                </tr>
              </thead>
              <tbody>
                {run.lines.map((l) => (
                  <tr key={l.id} className="border-b border-parch-line last:border-0">
                    <td className="p-3">{l.employee.name}</td>
                    <td className="p-3">{formatSar(l.basic)}</td>
                    <td className="p-3 text-ink-soft">{formatSar(l.allowances)}</td>
                    <td className="p-3 text-ink-soft">{formatSar(l.gosi)}</td>
                    <td className="p-3 text-ink-soft">{formatSar(l.advanceDeduction)}</td>
                    <td className="p-3">{formatSar(l.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="font-serif text-xl text-bench">{t("hr.wps.title")}</h2>
            {!wpsFile ? (
              <Link href={`/hr/payroll/${id}?wps=1`} className="rounded-lg bg-bench px-3 py-1.5 text-sm font-medium text-white hover:bg-bench-2">
                {t("hr.action.wps")}
              </Link>
            ) : null}
          </div>
          {wpsFile ? (
            <>
              <p className="mb-2 text-sm text-ink-soft">{t("hr.wps.download")}</p>
              {wpsFile.missingIban.length > 0 ? (
                <p className="mb-2 text-sm text-advocate">
                  {t("hr.wps.missingIban")}: {wpsFile.missingIban.join("، ")}
                </p>
              ) : null}
              <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                <table className="w-full text-right text-sm">
                  <thead className="border-b border-line text-ink-soft">
                    <tr>
                      <th className="p-3 font-medium">{t("hr.col.employee")}</th>
                      <th className="p-3 font-medium">{t("hr.wps.iban")}</th>
                      <th className="p-3 font-medium">{t("hr.payroll.deductions")}</th>
                      <th className="p-3 font-medium">{t("hr.net")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wpsFile.records.map((r, i) => (
                      <tr key={i} className="border-b border-parch-line last:border-0">
                        <td className="p-3">{r.employeeName}</td>
                        <td className="p-3 font-mono text-xs text-ink-soft">{r.iban ?? "—"}</td>
                        <td className="p-3 text-ink-soft">{formatSar(r.deductionsMinor)}</td>
                        <td className="p-3">{formatSar(r.netMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      </>
    );
  } catch (e) {
    if (e instanceof PermissionError) content = <DeniedPanel />;
    else throw e;
  }

  return <AppShell>{content}</AppShell>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-soft">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}
