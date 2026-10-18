import { hrAdvances, hrEmployees } from "@murafaa/sdk";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { AdvanceForm } from "@/components/hr/hr-forms";
import { hrAccess } from "@/components/hr/hr-access";
import { CELL, HrTable, Pill, ROW, SOFT } from "@/components/hr/hr-ui";
import { HrHeader } from "../hr-header";

/** السُّلف (legacy /hr/advances). */
export default async function AdvancesPage() {
  const { api, canEdit } = await hrAccess();
  const [advances, employees] = await Promise.all([
    hrAdvances({ client: api }),
    hrEmployees({ client: api }),
  ]);
  const rows = advances.data?.data;
  if (!rows || !employees.data)
    return (
      <>
        <HrHeader />
        <DeniedPanel />
      </>
    );
  const working = employees.data.data.filter((e) => e.status !== "TERMINATED");
  return (
    <>
      <HrHeader />
      {canEdit && <AdvanceForm employees={working} />}
      {rows.length === 0 ? (
        <p className="text-ink-soft">{t("hr.empty.advances")}</p>
      ) : (
        <HrTable
          head={[
            t("hr.col.employee"),
            t("hr.col.amount"),
            t("hr.advance.monthly"),
            t("hr.advance.remaining"),
            t("hr.col.status"),
          ]}
        >
          {rows.map((a) => (
            <tr key={a.id} className={ROW}>
              <td className={CELL}>{a.employeeName}</td>
              <td className={CELL}>{formatSar(a.amount)}</td>
              <td className={SOFT}>{formatSar(a.monthlyDue)}</td>
              <td className={CELL}>{formatSar(a.remaining)}</td>
              <td className={CELL}>
                <Pill
                  tone={a.status === "SETTLED" ? "ok" : a.status === "CANCELLED" ? "muted" : "gold"}
                >
                  {t(`advStatus.${a.status}` as MessageKey)}
                </Pill>
              </td>
            </tr>
          ))}
        </HrTable>
      )}
    </>
  );
}
