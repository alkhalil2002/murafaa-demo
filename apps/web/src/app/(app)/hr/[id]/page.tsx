import Link from "next/link";
import { notFound } from "next/navigation";
import { hrEmployee } from "@murafaa/sdk";
import { formatSar, roleLabel, t, type MessageKey } from "@murafaa/i18n";
import { GrantAccountForm, TerminateButton } from "@/components/hr/hr-forms";
import { hrAccess } from "@/components/hr/hr-access";
import { CELL, HrTable, Pill, ROW } from "@/components/hr/hr-ui";
import { fmtDate } from "@/lib/dates-ui";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <div className="v" style={{ fontSize: 22.5 }}>
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
    <HrTable head={head}>
      {rows.map((r, i) => (
        <tr key={i} className={ROW}>
          {r.map((cell, j) => (
            <td key={j} className={CELL}>
              {cell}
            </td>
          ))}
        </tr>
      ))}
    </HrTable>
  );
}

/** ملف الموظف (legacy /hr/[id]). */
export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { api, canFull, isPartner } = await hrAccess();
  const e = (await hrEmployee({ client: api, path: { id } })).data?.data;
  if (!e) notFound();
  const terminated = e.status === "TERMINATED";
  const n = (v: number) => v.toLocaleString("ar-SA");
  return (
    <>
      <Link href="/hr" className="backbtn">
        ‹ {t("hr.tab.employees")}
      </Link>
      <div className="vhead">
        <h2>{e.name}</h2>
        <Pill tone={terminated ? "muted" : "ok"}>{t(`empStatus.${e.status}` as MessageKey)}</Pill>
        <span className="pill">
          {[e.jobTitle, e.department].filter(Boolean).join(" · ") || "—"}
        </span>
      </div>
      <div className="kpis">
        <Field label={t("hr.nationality")} value={e.nationality} />
        <Field label={t("hr.hireDate")} value={e.hireDate} />
        <Field label={t("hr.basicSalary")} value={formatSar(e.basicSalary)} />
        <Field label={t("hr.allowances")} value={formatSar(e.allowances)} />
        <Field label={t("hr.gosi")} value={formatSar(e.gosiContribution)} />
        <Field label={t("hr.leaveBalance")} value={n(e.leaveBalanceDays)} />
        {e.ibanMasked ? <Field label="IBAN" value={e.ibanMasked} /> : null}
        {e.performanceScore != null ? (
          <Field label={t("hr.performance")} value={n(e.performanceScore)} />
        ) : null}
      </div>
      <div className="panel">
        <div className="sub" style={{ marginBottom: 4 }}>
          {terminated ? t("hr.eos.due") : t("hr.eos.preview")}
        </div>
        <div
          style={{ fontFamily: "var(--font-amiri), serif", fontSize: 30, color: "var(--bench)" }}
        >
          {formatSar(e.endOfService.awardMinor)}
        </div>
        <div className="sub" style={{ marginTop: 4, marginBottom: 0 }}>
          {t("hr.serviceYears")}: {e.endOfService.years != null ? n(e.endOfService.years) : "—"}
          {terminated && e.terminatedAt ? ` · ${fmtDate(e.terminatedAt)}` : ""}
        </div>
      </div>

      <Section title={t("hr.account.title")}>
        {e.account ? (
          <div className="panel">
            <div className="approve-row" style={{ border: "none", padding: 0 }}>
              <span
                className="ndot"
                style={{ background: e.account.isActive ? "var(--ok)" : "var(--ink-soft)" }}
              />
              <span className="at">
                {e.account.name}
                <span className="chip"> {roleLabel(e.account.role)}</span>
              </span>
              <span className="chip" dir="ltr">
                {e.account.phone}
              </span>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-soft">{t("hr.account.none")}</p>
            {canFull && !terminated && (
              <GrantAccountForm employeeId={e.id} canGrantPartner={isPartner} />
            )}
          </>
        )}
      </Section>

      <Section title={t("hr.advances")}>
        <MiniTable
          empty={t("hr.empty.advances")}
          head={[
            t("hr.col.amount"),
            t("hr.advance.monthly"),
            t("hr.advance.remaining"),
            t("hr.col.status"),
          ]}
          rows={e.advances.map((a) => [
            formatSar(a.amount),
            formatSar(a.monthlyDue),
            formatSar(a.remaining),
            t(`advStatus.${a.status}` as MessageKey),
          ])}
        />
      </Section>
      <Section title={t("hr.leaves")}>
        <MiniTable
          empty={t("hr.empty.leaves")}
          head={[t("hr.col.type"), t("hr.col.days"), t("hr.col.date")]}
          rows={e.leaves.map((l) => [
            t(`leaveType.${l.type}` as MessageKey),
            n(l.days),
            l.startDate,
          ])}
        />
      </Section>
      <Section title={t("hr.requests")}>
        <MiniTable
          empty={t("hr.empty.requests")}
          head={[t("hr.col.type"), t("hr.col.status"), t("hr.col.detail")]}
          rows={e.requests.map((r) => [
            t(`reqKind.${r.kind}` as MessageKey),
            t(`reqStatus.${r.status}` as MessageKey),
            r.detail ?? "—",
          ])}
        />
      </Section>
      {!terminated && canFull && <TerminateButton employeeId={e.id} />}
    </>
  );
}
