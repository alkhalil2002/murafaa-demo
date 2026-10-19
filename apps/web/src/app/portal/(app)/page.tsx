import Link from "next/link";
import { clientPortalListInvoices } from "@murafaa/sdk";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { serverApi } from "@/lib/api";
import { fmtDate } from "@/lib/dates-ui";
import { arNum, clientPortalData, urgencyText, urgencyTone } from "@/lib/portal-data";

/** قضاياي: KPIs, the approvals waiting for the client, and the case cards. */
export default async function PortalCasesPage() {
  const data = await clientPortalData();
  if (!data) return null;
  const invoices = (await clientPortalListInvoices({ client: await serverApi() })).data?.data ?? [];
  const { me, cases, details } = data;
  const active = cases.filter((c) => c.status === "ACTIVE");
  const pending = details.flatMap((d) =>
    d.approvals.filter((a) => a.status === "PENDING").map((a) => ({ ...a, caseTitle: d.title })),
  );
  const next = cases
    .map((c) => c.nextHearing)
    .filter((h): h is string => h !== null)
    .sort()[0];
  const outstanding = invoices.reduce((s, i) => s + i.remaining, 0);
  return (
    <>
      <div className="vhead">
        <h2>{t("portal.dashboard.title")}</h2>
        <span className="pill">{t("portal.dashboard.greeting", { name: me.name })}</span>
      </div>
      <div className="kpis">
        <div className="kpi">
          <div className="v">{arNum(active.length)}</div>
          <div className="l">{t("portal.kpi.active")}</div>
        </div>
        <div className="kpi">
          <div className="v">{next ? urgencyText(next) : t("common.none")}</div>
          <div className="l">{t("portal.kpi.nextHearing")}</div>
        </div>
        <div className={`kpi${pending.length > 0 ? " warn" : ""}`}>
          <div className="v">{arNum(pending.length)}</div>
          <div className="l">{t("portal.kpi.pendingApprovals")}</div>
        </div>
        <div className="kpi">
          <div className="v">{formatSar(outstanding)}</div>
          <div className="l">{t("portal.kpi.outstanding")}</div>
        </div>
      </div>
      {pending.length > 0 && (
        <div className="panel">
          <h2>
            <span className="n">{t("portal.pending.badge")}</span>
            {t("portal.pending.title")}
          </h2>
          {pending.map((a) => (
            <Link href="/portal/approvals" className="approve-row" key={a.id}>
              <span className="ndot" style={{ background: "var(--status-warning-dot)" }} />
              <span className="at">
                {a.title}{" "}
                <span className="chip">{t(`clientApprovalKind.${a.kind}` as MessageKey)}</span>
              </span>
              <span className="chip">{a.caseTitle}</span>
            </Link>
          ))}
        </div>
      )}
      {cases.length === 0 ? (
        <div className="empty-list">{t("portal.dashboard.empty")}</div>
      ) : (
        <div className="clist">
          {cases.map((c) => {
            const done = c.status !== "ACTIVE";
            return (
              <Link
                href={`/portal/cases/${c.id}`}
                className={`ccard${done ? " done" : ""}`}
                key={c.id}
              >
                <h3>{c.title}</h3>
                <div className="chips">
                  <span className="chip">{c.number}</span>
                  <span className={`chip ${done ? "t-neutral" : "t-ok"}`}>
                    {t(`case.status.${c.status}` as MessageKey)}
                  </span>
                  <span className="chip">{t(`case.stage.${c.stage}` as MessageKey)}</span>
                  {c.nextHearing && (
                    <span className={`chip ${urgencyTone(c.nextHearing)}`}>
                      {t("portal.hearingIn", { when: urgencyText(c.nextHearing) })}
                    </span>
                  )}
                </div>
                {c.nextHearing && (
                  <div className="meta">
                    {t("portal.dashboard.nextHearing", { date: fmtDate(c.nextHearing) })}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
