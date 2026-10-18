import { employeePortalProfile, employeePortalRequests } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { EmpRequestForm } from "@/components/portal/portal-forms";
import { serverApi } from "@/lib/api";

const TONE: Record<string, string> = {
  SUBMITTED: "var(--gold)",
  IN_REVIEW: "var(--gold)",
  APPROVED: "var(--ok)",
  REJECTED: "var(--advocate)",
};
const arNum = (n: number) => n.toLocaleString("ar-SA");

/** بوابة الموظف (legacy emp-portal page): balance, score, new request, own requests. */
export default async function EmpPortalPage() {
  const api = await serverApi();
  const [profile, requests] = await Promise.all([
    employeePortalProfile({ client: api }),
    employeePortalRequests({ client: api }),
  ]);
  const p = profile.data?.data;
  const list = requests.data?.data ?? [];
  if (!p) return null;
  return (
    <>
      <div className="vhead">
        <h2>{t("empPortal.title")}</h2>
        <span className="pill">
          {p.jobTitle ?? "—"}
          {p.department ? ` · ${p.department}` : ""}
        </span>
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="v">{arNum(p.leaveBalanceDays)}</div>
          <div className="l">{t("empPortal.leaveBalance")}</div>
        </div>
        {p.performanceScore !== null && (
          <div className="kpi">
            <div className="v">{t("common.percent", { n: arNum(p.performanceScore) })}</div>
            <div className="l">{t("empPortal.performance")}</div>
          </div>
        )}
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("empPortal.newRequest")}</h2>
        <EmpRequestForm />
      </div>
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>{t("empPortal.myRequests")}</h2>
        {list.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("empPortal.myRequests.empty")}
          </div>
        ) : (
          <div className="clist">
            {list.map((r) => (
              <div key={r.id} className="approve-row">
                <span className="at">
                  {t(`reqKind.${r.kind}` as MessageKey)}
                  {r.detail ? ` — ${r.detail}` : ""}
                  {r.days ? ` (${arNum(r.days)} ${t("empPortal.form.days")})` : ""}
                </span>
                <span
                  className="chip"
                  style={{ color: TONE[r.status], borderColor: TONE[r.status] }}
                >
                  {t(`reqStatus.${r.status}` as MessageKey)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
