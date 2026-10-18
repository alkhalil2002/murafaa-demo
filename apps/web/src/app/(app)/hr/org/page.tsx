import { hrOrg } from "@murafaa/sdk";
import { t } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";
import { HrHeader } from "../hr-header";

/** الهيكل التنظيمي (legacy /hr/org): active staff by department, no invented hierarchy. */
export default async function OrgPage() {
  const groups = (await hrOrg({ client: await serverApi() })).data?.data;
  return (
    <>
      <HrHeader />
      {!groups ? (
        <DeniedPanel />
      ) : (
        <div className="clist">
          {groups.map((g) => (
            <div key={g.department ?? ""} className="dcard">
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                {g.department ?? t("hr.org.noDept")}
              </div>
              <div className="chips" style={{ flexWrap: "wrap" }}>
                {g.employees.map((e) => (
                  <span key={e.id} className="chip">
                    {e.name}
                    {e.jobTitle ? ` — ${e.jobTitle}` : ""}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
