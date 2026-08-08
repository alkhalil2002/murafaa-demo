import { redirect } from "next/navigation";
import { RequestKind, RequestStatus } from "@prisma/client";
import { getEmpPortalSession } from "@/lib/auth/emp-portal-session";
import { getEmpPortalProfile, listMyRequests } from "@/server/emp-portal";
import { submitEmpRequestAction } from "../actions";
import { requestKindLabel, requestStatusLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";

const arNum = (n: number) => n.toLocaleString("ar-SA");

const STATUS_TONE: Record<RequestStatus, string> = {
  [RequestStatus.SUBMITTED]: "var(--gold)",
  [RequestStatus.IN_REVIEW]: "var(--gold)",
  [RequestStatus.APPROVED]: "var(--ok)",
  [RequestStatus.REJECTED]: "var(--advocate)",
};

export default async function EmpPortalPage() {
  const session = await getEmpPortalSession();
  if (!session) redirect("/emp-portal/login");

  const [profile, requests] = await Promise.all([getEmpPortalProfile(session), listMyRequests(session)]);

  return (
    <>
      <div className="vhead">
        <h2>{t("empPortal.title")}</h2>
        <span className="pill">
          {profile.jobTitle ?? "—"}
          {profile.department ? ` · ${profile.department}` : ""}
        </span>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="v">{arNum(profile.leaveBalanceDays)}</div>
          <div className="l">{t("empPortal.leaveBalance")}</div>
        </div>
        {profile.performanceScore !== null && (
          <div className="kpi">
            <div className="v">{arNum(profile.performanceScore)}٪</div>
            <div className="l">{t("empPortal.performance")}</div>
          </div>
        )}
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("empPortal.newRequest")}</h2>
        <form action={submitEmpRequestAction} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <label className="field" style={{ minWidth: 160 }}>
            <span>{t("empPortal.form.kind")}</span>
            <select name="kind" defaultValue={RequestKind.LEAVE}>
              {Object.values(RequestKind).map((k) => (
                <option key={k} value={k}>
                  {requestKindLabel(k)}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ width: 100 }}>
            <span>{t("empPortal.form.days")}</span>
            <input type="number" name="days" min={1} step={1} />
          </label>
          <label className="field" style={{ flex: 1, minWidth: 200 }}>
            <span>{t("empPortal.form.detail")}</span>
            <input type="text" name="detail" />
          </label>
          <button type="submit" className="act b-add">
            {t("empPortal.form.submit")}
          </button>
        </form>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("empPortal.myRequests")}</h2>
        {requests.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>{t("empPortal.myRequests.empty")}</div>
        ) : (
          <div className="clist">
            {requests.map((r) => (
              <div key={r.id} className="approve-row">
                <span className="at">
                  {requestKindLabel(r.kind)}
                  {r.detail ? ` — ${r.detail}` : ""}
                  {r.days ? ` (${arNum(r.days)} ${t("empPortal.form.days")})` : ""}
                </span>
                <span className="chip" style={{ color: STATUS_TONE[r.status], borderColor: STATUS_TONE[r.status] }}>
                  {requestStatusLabel(r.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
