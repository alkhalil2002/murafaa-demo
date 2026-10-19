import { employeePortalLeaves, employeePortalProfile } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { serverApi } from "@/lib/api";
import { fmtDate, todayIso } from "@/lib/dates-ui";
import { arNum } from "@/lib/portal-data";

/** الإجازات: the annual balance and the employee's recorded leaves. */
export default async function EmpLeavesPage() {
  const client = await serverApi();
  const [profile, leavesRes] = await Promise.all([
    employeePortalProfile({ client }),
    employeePortalLeaves({ client }),
  ]);
  const p = profile.data?.data;
  if (!p) return null;
  const leaves = leavesRes.data?.data ?? [];
  const today = todayIso();
  const year = today.slice(0, 4);
  const usedAnnual = leaves
    .filter((l) => l.type === "ANNUAL" && l.startDate.startsWith(year))
    .reduce((s, l) => s + l.days, 0);
  const upcoming = leaves.filter((l) => l.startDate >= today).length;
  return (
    <>
      <div className="vhead">
        <h2>{t("empPortal.nav.leaves")}</h2>
        <span className="pill">{t("empPortal.leaves.pill")}</span>
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="v">{arNum(p.leaveBalanceDays)}</div>
          <div className="l">{t("empPortal.leaveBalance")}</div>
        </div>
        <div className="kpi">
          <div className="v">{arNum(usedAnnual)}</div>
          <div className="l">{t("empPortal.leaves.usedThisYear")}</div>
        </div>
        <div className="kpi">
          <div className="v">{arNum(upcoming)}</div>
          <div className="l">{t("empPortal.leaves.upcoming")}</div>
        </div>
      </div>
      <div className="panel" style={{ overflowX: "auto" }}>
        {leaves.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("empPortal.leaves.empty")}
          </div>
        ) : (
          <table className="htable">
            <thead>
              <tr>
                <th>{t("empPortal.leaves.type")}</th>
                <th>{t("empPortal.leaves.start")}</th>
                <th>{t("empPortal.leaves.days")}</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id}>
                  <td>{t(`leaveType.${l.type}` as MessageKey)}</td>
                  <td>{fmtDate(l.startDate)}</td>
                  <td>{arNum(l.days)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
