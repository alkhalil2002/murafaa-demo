import Link from "next/link";
import { clientPortalListCases } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { serverApi } from "@/lib/api";
import { fmtDate } from "@/lib/dates-ui";

/** قضاياك (legacy portal dashboard). */
export default async function PortalCasesPage() {
  const cases = (await clientPortalListCases({ client: await serverApi() })).data?.data ?? [];
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
        cases.map((c) => (
          <Link
            href={`/portal/cases/${c.id}`}
            className="panel"
            style={{ display: "block", marginBottom: 10 }}
            key={c.id}
          >
            <div className="approve-row" style={{ border: "none", padding: 0 }}>
              <span className="ndot" style={{ background: "var(--bench)" }} />
              <span className="at">
                {c.title}
                <span className="chip"> {t(`case.stage.${c.stage}` as MessageKey)}</span>
              </span>
              <span className="chip st">{t(`case.status.${c.status}` as MessageKey)}</span>
            </div>
            {c.nextHearing && (
              <div className="sub" style={{ marginTop: 6, marginBottom: 0 }}>
                {t("portal.dashboard.nextHearing", { date: fmtDate(c.nextHearing) })}
              </div>
            )}
          </Link>
        ))
      )}
    </>
  );
}
