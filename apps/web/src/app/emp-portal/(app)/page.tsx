import {
  employeePortalAdvances,
  employeePortalLeaves,
  employeePortalProfile,
  employeePortalRequests,
} from "@murafaa/sdk";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { RequestRow } from "@/components/portal/emp-blocks";
import { EmpRequestForm } from "@/components/portal/portal-forms";
import { serverApi } from "@/lib/api";
import { fmtDate, todayIso } from "@/lib/dates-ui";
import { arNum } from "@/lib/portal-data";

/** الرئيسية: balances, the open advance, recent requests and upcoming leaves. */
export default async function EmpPortalHome() {
  const client = await serverApi();
  const [profile, requests, leaves, advances] = await Promise.all([
    employeePortalProfile({ client }),
    employeePortalRequests({ client }),
    employeePortalLeaves({ client }),
    employeePortalAdvances({ client }),
  ]);
  const p = profile.data?.data;
  if (!p) return null;
  const list = requests.data?.data ?? [];
  const today = todayIso();
  const upcoming = (leaves.data?.data ?? []).filter((l) => l.startDate >= today).reverse();
  const open = (advances.data?.data ?? []).filter((a) => a.remaining > 0 && a.status === "ACTIVE");
  const remaining = open.reduce((s, a) => s + a.remaining, 0);
  const monthly = open.reduce((s, a) => s + a.monthlyDue, 0);
  const inReview = list.filter((r) => r.status === "SUBMITTED" || r.status === "IN_REVIEW");
  return (
    <>
      <div className="vhead">
        <h2>{t("empPortal.greeting", { name: p.name.split(" ")[0] ?? p.name })}</h2>
        {p.jobTitle && (
          <span className="pill">
            {p.jobTitle}
            {p.department ? ` · ${p.department}` : ""}
          </span>
        )}
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="v">{arNum(p.leaveBalanceDays)}</div>
          <div className="l">{t("empPortal.leaveBalance")}</div>
        </div>
        <div className={`kpi${inReview.length > 0 ? " warn" : ""}`}>
          <div className="v">{arNum(inReview.length)}</div>
          <div className="l">{t("empPortal.kpi.pendingRequests")}</div>
        </div>
        {p.performanceScore !== null && (
          <div className="kpi">
            <div className="v">{t("common.percent", { n: arNum(p.performanceScore) })}</div>
            <div className="l">{t("empPortal.performance")}</div>
          </div>
        )}
        {remaining > 0 && (
          <div className="kpi">
            <div className="v">{formatSar(remaining)}</div>
            <div className="l">
              {t("empPortal.kpi.advanceRemaining")}
              <br />
              {t("empPortal.kpi.advanceMonthly", { amount: formatSar(monthly) })}
            </div>
          </div>
        )}
      </div>
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="panel">
          <h2>
            <span className="n">{t("empPortal.recent.badge")}</span>
            {t("empPortal.recent.title")}
          </h2>
          {list.length === 0 ? (
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("empPortal.myRequests.empty")}
            </div>
          ) : (
            list.slice(0, 3).map((r) => <RequestRow key={r.id} r={r} />)
          )}
        </div>
        <div className="panel">
          <h2>
            <span className="n">{t("empPortal.upcoming.badge")}</span>
            {t("empPortal.upcoming.title")}
          </h2>
          {upcoming.length === 0 ? (
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("empPortal.upcoming.empty")}
            </div>
          ) : (
            upcoming.map((l) => (
              <div className="approve-row" key={l.id}>
                <span className="ndot" style={{ background: "var(--status-success-dot)" }} />
                <span className="at">
                  {t(`leaveType.${l.type}` as MessageKey)} — {fmtDate(l.startDate)}
                </span>
                <span className="chip">
                  {arNum(l.days)} {t("empPortal.form.days")}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="panel">
        <h2>{t("empPortal.newRequest")}</h2>
        <EmpRequestForm />
      </div>
    </>
  );
}
