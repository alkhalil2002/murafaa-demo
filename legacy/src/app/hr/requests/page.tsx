import { redirect } from "next/navigation";
import { EmployeeStatus, PermModule, RequestKind, RequestStatus } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { HrTabs } from "@/components/hr-tabs";
import { ErrBanner, Pill } from "@/components/hr-ui";
import { getSession } from "@/lib/auth/session";
import { listRequests } from "@/server/hr/requests";
import { listEmployees } from "@/server/hr/employees";
import { canAction, PermissionError } from "@/lib/permissions/guard";
import { requestKindLabel, requestStatusLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";
import { createRequestAction, decideRequestAction } from "../actions";

const STATUS_TONE = {
  [RequestStatus.SUBMITTED]: "gold",
  [RequestStatus.IN_REVIEW]: "warn",
  [RequestStatus.APPROVED]: "ok",
  [RequestStatus.REJECTED]: "bad",
} as const;

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { err } = await searchParams;

  let content: React.ReactNode;
  try {
    const [requests, employees] = await Promise.all([listRequests(session), listEmployees(session)]);
    const active = employees.filter((e) => e.status !== EmployeeStatus.TERMINATED);
    const canEdit = await canAction(session, PermModule.HR, "edit");

    content = (
      <>
        {canEdit ? (
        <form action={createRequestAction} className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-white p-4">
          <label className="text-sm">
            <span className="mb-1 block text-ink-soft">{t("hr.employee")}</span>
            <select name="employeeId" required className={INPUT} defaultValue="">
              <option value="" disabled>{t("hr.form.select")}</option>
              {active.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink-soft">{t("hr.col.type")}</span>
            <select name="kind" defaultValue={RequestKind.LEAVE} className={INPUT}>
              {Object.values(RequestKind).map((v) => <option key={v} value={v}>{requestKindLabel(v)}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink-soft">{t("hr.form.days")}</span>
            <input type="number" name="days" min="1" step="1" className={INPUT} style={{ width: 90 }} />
          </label>
          <label className="text-sm grow">
            <span className="mb-1 block text-ink-soft">{t("hr.form.detail")}</span>
            <input type="text" name="detail" className={INPUT} />
          </label>
          <button type="submit" className={BTN}>{t("hr.action.newRequest")}</button>
        </form>
        ) : null}

        {requests.length === 0 ? (
          <p className="text-ink-soft">{t("hr.empty.requests")}</p>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="border-b border-line text-ink-soft">
                <tr>
                  <th className="p-3 font-medium">{t("hr.col.employee")}</th>
                  <th className="p-3 font-medium">{t("hr.col.type")}</th>
                  <th className="p-3 font-medium">{t("hr.col.detail")}</th>
                  <th className="p-3 font-medium">{t("hr.col.status")}</th>
                  <th className="p-3 font-medium">{t("hr.col.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const decided = r.status === RequestStatus.APPROVED || r.status === RequestStatus.REJECTED;
                  return (
                    <tr key={r.id} className="border-b border-parch-line last:border-0">
                      <td className="p-3">{r.employee.name}</td>
                      <td className="p-3">{requestKindLabel(r.kind)}</td>
                      <td className="p-3 text-ink-soft">
                        {r.detail ?? "—"}
                        {r.days ? ` · ${r.days.toLocaleString("ar-SA")} ${t("hr.form.daysUnit")}` : ""}
                      </td>
                      <td className="p-3"><Pill tone={STATUS_TONE[r.status]}>{requestStatusLabel(r.status)}</Pill></td>
                      <td className="p-3">
                        {decided || !canEdit ? (
                          <span className="text-ink-soft">—</span>
                        ) : (
                          <div className="flex gap-2">
                            <DecideBtn id={r.id} status={RequestStatus.APPROVED} label={t("hr.action.approve")} tone="ok" />
                            <DecideBtn id={r.id} status={RequestStatus.REJECTED} label={t("hr.action.reject")} tone="bad" />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
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

function DecideBtn({ id, status, label, tone }: { id: string; status: RequestStatus; label: string; tone: "ok" | "bad" }) {
  const cls = tone === "ok"
    ? "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20"
    : "border-advocate/40 bg-advocate/10 text-advocate hover:bg-advocate/20";
  return (
    <form action={decideRequestAction}>
      <input type="hidden" name="requestId" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={`rounded-lg border px-3 py-1 text-xs font-medium ${cls}`}>{label}</button>
    </form>
  );
}

const INPUT = "w-full rounded-lg border border-line bg-parch px-3 py-2 text-sm";
const BTN = "rounded-lg bg-bench px-4 py-2 text-sm font-medium text-white hover:bg-bench-2";
