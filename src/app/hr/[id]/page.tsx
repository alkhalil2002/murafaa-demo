import Link from "next/link";
import { redirect } from "next/navigation";
import { AdvanceStatus, EmployeeStatus, PermModule, Role } from "@prisma/client";
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
  roleLabel,
} from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { maskIban } from "@/lib/format";
import { t } from "@/lib/i18n";
import { terminateEmployeeAction, grantEmployeeAccountAction } from "../actions";

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
        <Link href="/hr" className="backbtn">
          ‹ {t("hr.tab.employees")}
        </Link>
        <div className="vhead">
          <h2>{emp.name}</h2>
          <Pill tone={terminated ? "muted" : "ok"}>{employeeStatusLabel(emp.status)}</Pill>
          <span className="pill">{[emp.jobTitle, emp.department].filter(Boolean).join(" · ") || "—"}</span>
        </div>

        <div className="kpis">
          <Field label={t("hr.nationality")} value={emp.nationality} />
          <Field label={t("hr.hireDate")} value={fmtDate(emp.hireDate)} />
          <Field label={t("hr.basicSalary")} value={formatSar(emp.basicSalary)} />
          <Field label={t("hr.allowances")} value={formatSar(emp.allowances)} />
          <Field label={t("hr.gosi")} value={formatSar(emp.gosiContribution)} />
          <Field label={t("hr.leaveBalance")} value={`${emp.leaveBalanceDays}`} />
          {emp.iban ? <Field label="IBAN" value={maskIban(emp.iban)} /> : null}
          {emp.performanceScore != null ? <Field label={t("hr.performance")} value={`${emp.performanceScore}`} /> : null}
        </div>

        <div className="panel">
          <div className="sub" style={{ marginBottom: 4 }}>
            {terminated ? t("hr.eos.due") : t("hr.eos.preview")}
          </div>
          <div style={{ fontFamily: "var(--font-amiri), serif", fontSize: 24, color: "var(--bench)" }}>
            {formatSar(eos.awardMinor)}
          </div>
          <div className="sub" style={{ marginTop: 4, marginBottom: 0 }}>
            {t("hr.serviceYears")}: {eos.years ?? "—"}
            {terminated && emp.terminatedAt ? ` · ${fmtDate(emp.terminatedAt)}` : ""}
          </div>
        </div>

        <Section title={t("hr.account.title")}>
          {emp.user ? (
            <div className="panel">
              <div className="approve-row" style={{ border: "none", padding: 0 }}>
                <span className="ndot" style={{ background: emp.user.isActive ? "var(--ok)" : "var(--ink-soft)" }} />
                <span className="at">
                  {emp.user.name}
                  <span className="chip"> {roleLabel(emp.user.role)}</span>
                </span>
                <span className="chip" dir="ltr">{emp.user.phone}</span>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-ink-soft">{t("hr.account.none")}</p>
              {canTerminate && (
                <form action={grantEmployeeAccountAction} className="mt-2 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
                  <input type="hidden" name="employeeId" value={emp.id} />
                  <label className="text-sm">
                    <span className="mb-1 block text-ink-soft">{t("hr.account.phone")}</span>
                    <input type="text" name="phone" dir="ltr" placeholder="5XXXXXXXX" required className="w-full rounded-lg border border-line bg-parch px-3 py-2 text-sm" />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-ink-soft">{t("hr.account.role")}</span>
                    <select name="role" defaultValue={Role.RECEPTION} className="w-full rounded-lg border border-line bg-parch px-3 py-2 text-sm">
                      {Object.values(Role).map((r) => (
                        <option key={r} value={r}>{roleLabel(r)}</option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="rounded-lg bg-bench px-4 py-2 text-sm font-medium text-white hover:bg-bench-2">
                    {t("hr.account.grant")}
                  </button>
                </form>
              )}
            </>
          )}
        </Section>

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
    <div className="kpi">
      <div className="v" style={{ fontSize: 18 }}>
        {value}
      </div>
      <div className="l">{label}</div>
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
    <div className="panel overflow-x-auto">
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
