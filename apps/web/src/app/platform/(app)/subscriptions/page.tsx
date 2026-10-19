import Link from "next/link";
import { platformList } from "@murafaa/sdk";
import { daysLeft } from "@murafaa/rules";
import { t } from "@murafaa/i18n";
import { serverApi } from "@/lib/api";
import { fmtDate } from "@/lib/dates-ui";
import { dueOf, STATUS_TONE, statusLabel } from "@/lib/platform-ui";
import { arNum } from "@/lib/portal-data";

/**
 * الاشتراكات: each office's trial end or paid-until day. Billing is by hand
 * (owner, 2026-10-19): no plans, no invoices, no online payment.
 */
export default async function PlatformSubscriptionsPage() {
  const offices = (await platformList({ client: await serverApi() })).data?.data ?? [];
  const dated = offices.map((o) => ({ o, due: dueOf(o) }));
  const soon = dated.filter(
    (x) => x.due && daysLeft(x.due.date) >= 0 && daysLeft(x.due.date) <= 30,
  );
  const overdue = dated.filter((x) => x.due && daysLeft(x.due.date) < 0);
  return (
    <>
      <div className="vhead">
        <h2>{t("platform.nav.subscriptions")}</h2>
        <span className="pill">{t("platform.subs.pill")}</span>
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="v">{arNum(offices.filter((o) => o.status === "ACTIVE").length)}</div>
          <div className="l">{t("platform.kpi.active")}</div>
        </div>
        <div className="kpi">
          <div className="v">{arNum(offices.filter((o) => o.status === "TRIAL").length)}</div>
          <div className="l">{t("platform.kpi.trial")}</div>
        </div>
        <div className={`kpi${soon.length > 0 ? " warn" : ""}`}>
          <div className="v">{arNum(soon.length)}</div>
          <div className="l">{t("platform.subs.dueSoon")}</div>
        </div>
        <div className={`kpi${overdue.length > 0 ? " warn" : ""}`}>
          <div className="v">{arNum(overdue.length)}</div>
          <div className="l">{t("platform.subs.overdue")}</div>
        </div>
      </div>
      <div className="panel" style={{ overflowX: "auto" }}>
        {offices.length === 0 ? (
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("platform.offices.none")}
          </div>
        ) : (
          <table className="htable">
            <thead>
              <tr>
                <th>{t("platform.subs.office")}</th>
                <th>{t("platform.field.status")}</th>
                <th>{t("platform.subs.until")}</th>
                <th>{t("platform.subs.remaining")}</th>
                <th>{t("platform.compliance.payment")}</th>
              </tr>
            </thead>
            <tbody>
              {dated.map(({ o, due }) => (
                <tr key={o.id}>
                  <td>
                    <Link
                      href={`/platform/offices/${o.id}?tab=subscription`}
                      style={{ fontWeight: 600 }}
                    >
                      {o.name}
                    </Link>
                  </td>
                  <td>
                    <span className={`chip ${STATUS_TONE[o.status]}`}>{statusLabel(o.status)}</span>
                  </td>
                  <td>{due ? fmtDate(due.date) : "—"}</td>
                  <td>{due ? <span className={`chip ${due.tone}`}>{due.text}</span> : "—"}</td>
                  <td>
                    <span className="chip t-neutral">{t("platform.compliance.notConnected")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
