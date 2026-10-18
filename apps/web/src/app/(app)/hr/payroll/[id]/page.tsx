import Link from "next/link";
import { notFound } from "next/navigation";
import { hrPayrollRun, hrWps } from "@murafaa/sdk";
import { formatSar, t } from "@murafaa/i18n";
import { CELL, HrTable, Pill, ROW, SOFT } from "@/components/hr/hr-ui";
import { serverApi } from "@/lib/api";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <div className="v" style={{ fontSize: 25 }}>
        {value}
      </div>
      <div className="l">{label}</div>
    </div>
  );
}

/** One posted payroll run, and its WPS records on request (legacy /hr/payroll/[id]). */
export default async function PayrollRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ wps?: string }>;
}) {
  const { id } = await params;
  const { wps } = await searchParams;
  const api = await serverApi();
  const run = (await hrPayrollRun({ client: api, path: { id } })).data?.data;
  if (!run) notFound();
  const file = wps === "1" ? (await hrWps({ client: api, path: { id } })).data?.data : null;
  return (
    <>
      <Link href="/hr/payroll" className="backbtn">
        ‹ {t("hr.tab.payroll")}
      </Link>
      <div className="vhead">
        <h2>{run.periodKey}</h2>
        <Pill tone="ok">{t("hr.payroll.posted")}</Pill>
      </div>
      <div className="kpis">
        <Field label={t("hr.gross")} value={formatSar(run.totalBasic + run.totalAllowances)} />
        <Field label={t("hr.gosi")} value={formatSar(run.totalGosi)} />
        <Field label={t("hr.advances")} value={formatSar(run.totalAdvances)} />
        <Field label={t("hr.net")} value={formatSar(run.totalNet)} />
        <Field label={t("hr.col.employee")} value={run.lines.length.toLocaleString("ar-SA")} />
      </div>
      <section className="mt-6">
        <h2 className="mb-3 font-serif text-xl text-bench">{t("hr.tab.payroll")}</h2>
        <HrTable
          head={[
            t("hr.col.employee"),
            t("hr.basicSalary"),
            t("hr.allowances"),
            t("hr.gosi"),
            t("hr.advance.monthly"),
            t("hr.net"),
          ]}
        >
          {run.lines.map((l) => (
            <tr key={l.id} className={ROW}>
              <td className={CELL}>{l.employeeName}</td>
              <td className={CELL}>{formatSar(l.basic)}</td>
              <td className={SOFT}>{formatSar(l.allowances)}</td>
              <td className={SOFT}>{formatSar(l.gosi)}</td>
              <td className={SOFT}>{formatSar(l.advanceDeduction)}</td>
              <td className={CELL}>{formatSar(l.net)}</td>
            </tr>
          ))}
        </HrTable>
      </section>
      <section className="mt-6">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="font-serif text-xl text-bench">{t("hr.wps.title")}</h2>
          {!file ? (
            <Link
              href={`/hr/payroll/${id}?wps=1`}
              className="rounded-lg bg-bench px-3 py-1.5 text-sm font-medium text-white hover:bg-bench-2"
            >
              {t("hr.action.wps")}
            </Link>
          ) : null}
        </div>
        {file ? (
          <>
            <p className="mb-2 text-sm text-ink-soft">{t("hr.wps.download")}</p>
            {file.missingIban.length > 0 ? (
              <p className="mb-2 text-sm text-advocate">
                {t("hr.wps.missingIban")}: {file.missingIban.join(t("common.listSep"))}
              </p>
            ) : null}
            <HrTable
              head={[
                t("hr.col.employee"),
                t("hr.wps.iban"),
                t("hr.payroll.deductions"),
                t("hr.net"),
              ]}
            >
              {file.records.map((r, i) => (
                <tr key={i} className={ROW}>
                  <td className={CELL}>{r.employeeName}</td>
                  <td className="p-3 font-mono text-xs text-ink-soft" dir="ltr">
                    {r.ibanMasked ?? "—"}
                  </td>
                  <td className={SOFT}>{formatSar(r.deductions)}</td>
                  <td className={CELL}>{formatSar(r.net)}</td>
                </tr>
              ))}
            </HrTable>
          </>
        ) : null}
      </section>
    </>
  );
}
