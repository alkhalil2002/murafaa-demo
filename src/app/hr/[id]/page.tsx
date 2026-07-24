import Link from "next/link";
import { redirect } from "next/navigation";
import { AdvanceStatus, EmployeeStatus, PermModule } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { ErrBanner, Pill } from "@/components/hr-ui";
import { getSession } from "@/lib/auth/session";
import { getEmployee, previewEndOfService } from "@/server/hr/employees";
import { advanceMonthly, advanceRemaining } from "@/lib/hr/core";
import { canAction, PermissionError } from "@/lib/permissions/guard";
import {
  advanceStatusLabel,
  employeeStatusLabel,
  leaveTypeLabel,
  requestKindLabel,
  requestStatusLabel,
} from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";
import { terminateEmployeeAction } from "../actions";

const fmtDate = (d: Date) => new Date(d).toISOString().slice(0, 10);

export default async function EmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const { err } = await searchParams;

  let content: React.ReactNode;
  try {
    const emp = await getEmployee(session, id);
    // Terminating freezes end-of-service — a delete-class action needing FULL HR
    // (PARTNER). Hide the control from roles that cannot perform it.
    const canTerminate = await canAction(session, PermModule.HR, "delete");
    const terminated = emp.status === EmployeeStatus.TERMINATED;
    const eos = terminated
      ? { years: null as number | null, awardMinor: emp.endOfServiceMinor ?? 0 }
      : previewEndOfService(emp);

    content = (
      <>
        <Link href="/hr" className="text-sm text-ink-soft hover:underline">→ {t("hr.tab.employees")}</Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="font-serif text-3xl text-bench">{emp.name}</h1>
          <Pill tone={terminated ? "muted" : "ok"}>{employeeStatusLabel(emp.status)}</Pill>
        </div>
        <p className="mt-1 text-ink-soft">
          {[emp.jobTitle, emp.department].filter(Boolean).join(" · ") || "—"}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-4 rounded-2xl border border-line bg-white p-5 text-sm md:grid-cols-4">
          <Field label={t("hr.nationality")} value={emp.nationality} />
          <Field label={t("hr.hireDate")} value={fmtDate(emp.hireDate)} />
          <Field label={t("hr.basicSalary")} value={formatSar(emp.basicSalary)} />
          <Field label={t("hr.allowances")} value={formatSar(emp.allowances)} />
          <Field label={t("hr.gosi")} value={formatSar(emp.gosiContribution)} />
          <Field label={t("hr.leaveBalance")} value={`${emp.leaveBalanceDays}`} />
          {emp.iban ? <Field label="IBAN" value={emp.iban} /> : null}
          {emp.performanceScore != null ? <Field label={t("hr.performance")} value={`${emp.performanceScore}`} /> : null}
        </div>

        {/* End of service */}
        <div className="mt-4 rounded-2xl border border-line bg-white p-5">
          <div className="text-xs text-ink-soft">{terminated ? t("hr.eos.due") : t("hr.eos.preview")}</div>
          <div className="mt-1 font-serif text-2xl text-bench">{formatSar(eos.awardMinor)}</div>
          <div className="mt-0.5 text-xs text-ink-soft">
            {t("hr.serviceYears")}: {eos.years ?? "—"}
            {terminated && emp.terminatedAt ? ` · ${fmtDate(emp.terminatedAt)}` : ""}
          </div>
        </div>

        <Section title={t("hr.advances")}>
          <MiniTable
            empty={t("hr.empty.advances")}
            head={[t("hr.col.amount"), t("hr.advance.monthly"), t("hr.advance.remaining"), t("hr.col.status")]}
            rows={emp.advances.map((a) => [
              formatSar(a.amount),
              formatSar(advanceMonthly(a)),
              formatSar(advanceRemaining(a)),
              advanceStatusLabel(a.status),
            ])}
          />
        </Section>

        <Section title={t("hr.leaves")}>
          <MiniTable
            empty={t("hr.empty.leaves")}
            head={[t("hr.col.type"), t("hr.col.days"), t("hr.col.date")]}
            rows={emp.leaves.map((l) => [leaveTypeLabel(l.type), String(l.days), fmtDate(l.startDate)])}
          />
        </Section>

        <Section title={t("hr.requests")}>
          <MiniTable
            empty={t("hr.empty.requests")}
            head={[t("hr.col.type"), t("hr.col.status"), t("hr.col.detail")]}
            rows={emp.requests.map((r) => [requestKindLabel(r.kind), requestStatusLabel(r.status), r.detail ?? "—"])}
          />
        </Section>

        {!terminated && canTerminate ? (
          <form action={terminateEmployeeAction} className="mt-6">
            <input type="hidden" name="employeeId" value={emp.id} />
            <button
              type="submit"
              className="rounded-lg border border-advocate/40 bg-advocate/10 px-4 py-2 text-sm font-medium text-advocate hover:bg-advocate/20"
            >
              {t("hr.action.terminate")}
            </button>
          </form>
        ) : null}
      </>
    );
  } catch (e) {
    if (e instanceof PermissionError) content = <DeniedPanel />;
    else throw e;
  }

  return (
    <AppShell>
      <ErrBanner code={err} />
      {content}
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-soft">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 font-serif text-xl text-bench">{title}</h2>
      {children}
    </section>
  );
}

function MiniTable({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-ink-soft">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full text-right text-sm">
        <thead className="border-b border-line text-ink-soft">
          <tr>{head.map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-parch-line last:border-0">
              {r.map((c, j) => <td key={j} className="p-3">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
