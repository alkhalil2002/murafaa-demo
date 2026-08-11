import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/auth/portal-session";
import { listPortalCases } from "@/server/portal";
import { caseStatusLabel, stageLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";
import { formatDateAr } from "@/lib/dates";

function fmt(d: Date | null | undefined): string {
  return formatDateAr(d);
}

export default async function PortalDashboardPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const cases = await listPortalCases(session);

  return (
    <>
      <div className="vhead">
        <h2>{t("portal.dashboard.title")}</h2>
      </div>
      {cases.length === 0 ? (
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>
            {t("portal.dashboard.empty")}
          </div>
        </div>
      ) : (
        cases.map((c) => {
          const nextHearing = c.hearings[0];
          return (
            <Link href={`/portal/cases/${c.id}`} className="panel" style={{ display: "block", marginBottom: 10 }} key={c.id}>
              <div className="approve-row" style={{ border: "none", padding: 0 }}>
                <span className="ndot" style={{ background: "var(--bench)" }} />
                <span className="at">
                  {c.title}
                  <span className="chip"> {stageLabel(c.stage)}</span>
                </span>
                <span className="chip st">{caseStatusLabel(c.status)}</span>
              </div>
              {nextHearing && (
                <div className="sub" style={{ marginTop: 6, marginBottom: 0 }}>
                  {t("portal.dashboard.nextHearing", { date: fmt(nextHearing.hearingDate) })}
                </div>
              )}
            </Link>
          );
        })
      )}
    </>
  );
}
