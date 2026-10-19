import Link from "next/link";
import { t } from "@murafaa/i18n";
import { DecidedApproval, PendingApproval } from "@/components/portal/portal-blocks";
import { arNum, clientPortalData } from "@/lib/portal-data";

/** الاعتمادات: what the office asked the client to approve, across all their cases. */
export default async function PortalApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const data = await clientPortalData();
  if (!data) return null;
  const done = (await searchParams).tab === "done";
  const all = data.details.flatMap((d) =>
    d.approvals.map((a) => ({ a, caseId: d.id, caseTitle: d.title })),
  );
  const pending = all.filter((x) => x.a.status === "PENDING");
  const decided = all.filter((x) => x.a.status !== "PENDING");
  const count = (s: string) => arNum(decided.filter((x) => x.a.status === s).length);
  return (
    <>
      <div className="vhead">
        <h2>{t("portal.nav.approvals")}</h2>
        <span className="pill">{t("portal.approvals.pill")}</span>
      </div>
      <div className="kpis">
        <div className={`kpi${pending.length > 0 ? " warn" : ""}`}>
          <div className="v">{arNum(pending.length)}</div>
          <div className="l">{t("portal.approvals.kpiPending")}</div>
        </div>
        <div className="kpi">
          <div className="v">{count("APPROVED")}</div>
          <div className="l">{t("portal.approvals.kpiApproved")}</div>
        </div>
        <div className="kpi">
          <div className="v">{count("REJECTED")}</div>
          <div className="l">{t("portal.approvals.kpiRejected")}</div>
        </div>
      </div>
      <div className="ftabs">
        <Link href="/portal/approvals" className={`ftab${done ? "" : " on"}`}>
          {t("portal.approvals.tabPending", { n: arNum(pending.length) })}
        </Link>
        <Link href="/portal/approvals?tab=done" className={`ftab${done ? " on" : ""}`}>
          {t("portal.approvals.tabDone")}
        </Link>
      </div>
      {done ? (
        <div className="panel">
          {decided.length === 0 ? (
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("portal.approvals.noneDone")}
            </div>
          ) : (
            decided.map((x) => <DecidedApproval key={x.a.id} a={x.a} caseTitle={x.caseTitle} />)
          )}
        </div>
      ) : pending.length === 0 ? (
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("portal.approvals.nonePending")}
          </div>
        </div>
      ) : (
        pending.map((x) => (
          <PendingApproval key={x.a.id} caseId={x.caseId} caseTitle={x.caseTitle} a={x.a} />
        ))
      )}
    </>
  );
}
