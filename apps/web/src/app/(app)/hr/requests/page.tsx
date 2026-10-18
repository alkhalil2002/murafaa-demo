import { hrEmployees, hrRequests } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { DecideButtons, RequestForm } from "@/components/hr/hr-forms";
import { hrAccess } from "@/components/hr/hr-access";
import { CELL, HrTable, Pill, ROW, SOFT, type Tone } from "@/components/hr/hr-ui";
import { HrHeader } from "../hr-header";

const STATUS_TONE: Record<string, Tone> = {
  SUBMITTED: "gold",
  IN_REVIEW: "warn",
  APPROVED: "ok",
  REJECTED: "bad",
};

/** طلبات الموظفين (legacy /hr/requests). */
export default async function RequestsPage() {
  const { api, canEdit } = await hrAccess();
  const [requests, employees] = await Promise.all([
    hrRequests({ client: api }),
    hrEmployees({ client: api }),
  ]);
  const rows = requests.data?.data;
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
      {canEdit && <RequestForm employees={working} />}
      {rows.length === 0 ? (
        <p className="text-ink-soft">{t("hr.empty.requests")}</p>
      ) : (
        <HrTable
          head={[
            t("hr.col.employee"),
            t("hr.col.type"),
            t("hr.col.detail"),
            t("hr.col.status"),
            t("hr.col.actions"),
          ]}
        >
          {rows.map((r) => {
            const decided = r.status === "APPROVED" || r.status === "REJECTED";
            return (
              <tr key={r.id} className={ROW}>
                <td className={CELL}>{r.employeeName}</td>
                <td className={CELL}>{t(`reqKind.${r.kind}` as MessageKey)}</td>
                <td className={SOFT}>
                  {r.detail ?? "—"}
                  {r.days ? ` · ${r.days.toLocaleString("ar-SA")} ${t("hr.form.daysUnit")}` : ""}
                </td>
                <td className={CELL}>
                  <Pill tone={STATUS_TONE[r.status]}>
                    {t(`reqStatus.${r.status}` as MessageKey)}
                  </Pill>
                </td>
                <td className={CELL}>
                  {decided || !canEdit ? (
                    <span className="text-ink-soft">—</span>
                  ) : (
                    <DecideButtons id={r.id} />
                  )}
                </td>
              </tr>
            );
          })}
        </HrTable>
      )}
    </>
  );
}
