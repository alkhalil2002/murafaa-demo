import Link from "next/link";
import { hrAdvances, hrEmployees, hrSaudization } from "@murafaa/sdk";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { NewEmployeeForm } from "@/components/hr/hr-forms";
import { hrAccess } from "@/components/hr/hr-access";
import { CELL, HrTable, Pill, ROW, SOFT, StatCard, type Tone } from "@/components/hr/hr-ui";
import { HrHeader } from "./hr-header";

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "ok",
  ON_LEAVE: "gold",
  SUSPENDED: "warn",
  TERMINATED: "muted",
};

/** الموظفون (legacy /hr). */
export default async function HrPage() {
  const { api, canEdit } = await hrAccess();
  const [employees, advances, sz] = await Promise.all([
    hrEmployees({ client: api }),
    hrAdvances({ client: api }),
    hrSaudization({ client: api }),
  ]);
  const list = employees.data?.data;
  if (!list || !advances.data || !sz.data)
    return (
      <>
        <HrHeader />
        <DeniedPanel />
      </>
    );
  const active = advances.data.data.filter((a) => a.status === "ACTIVE");
  const s = sz.data.data;
  return (
    <>
      <HrHeader />
      <div className="kpis">
        <StatCard label={t("hr.kpi.staff")} value={list.length.toLocaleString("ar-SA")} />
        <StatCard
          label={t("hr.kpi.saudization")}
          value={t("common.percent", { n: Math.round(s.pct).toLocaleString("ar-SA") })}
          hint={t(`nitaqat.${s.band}` as MessageKey)}
        />
        <StatCard
          label={t("hr.kpi.activeAdvances")}
          value={active.length.toLocaleString("ar-SA")}
          hint={formatSar(active.reduce((sum, a) => sum + a.remaining, 0))}
        />
      </div>
      {list.length === 0 ? (
        <p className="text-ink-soft">{t("hr.empty.employees")}</p>
      ) : (
        <HrTable
          head={[
            t("hr.col.name"),
            t("hr.department"),
            t("hr.nationality"),
            t("hr.basicSalary"),
            t("hr.allowances"),
            t("hr.col.status"),
          ]}
        >
          {list.map((e) => (
            <tr key={e.id} className={`${ROW} hover:bg-parch`}>
              <td className={CELL}>
                <Link href={`/hr/${e.id}`} className="text-bench hover:underline">
                  {e.name}
                </Link>
                {e.jobTitle ? <div className="text-xs text-ink-soft">{e.jobTitle}</div> : null}
              </td>
              <td className={SOFT}>{e.department ?? "—"}</td>
              <td className={CELL}>{e.nationality}</td>
              <td className={CELL}>{formatSar(e.basicSalary)}</td>
              <td className={SOFT}>{formatSar(e.allowances)}</td>
              <td className={CELL}>
                <Pill tone={STATUS_TONE[e.status]}>{t(`empStatus.${e.status}` as MessageKey)}</Pill>
              </td>
            </tr>
          ))}
        </HrTable>
      )}
      {canEdit && <NewEmployeeForm />}
    </>
  );
}
