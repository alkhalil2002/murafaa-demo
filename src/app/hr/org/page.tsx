import { redirect } from "next/navigation";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { HrTabs } from "@/components/hr-tabs";
import { getSession } from "@/lib/auth/session";
import { getOrgChart } from "@/server/hr/org-chart";
import { PermissionError } from "@/lib/permissions/guard";
import { t } from "@/lib/i18n";

export default async function OrgChartPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const groups = await getOrgChart(session);
    content = (
      <div className="clist">
        {groups.map((g) => (
          <div key={g.department} className="dcard">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {g.department === "—" ? t("hr.org.noDept") : g.department}
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
    );
  } catch (e) {
    if (e instanceof PermissionError) content = <DeniedPanel />;
    else throw e;
  }

  return (
    <AppShell>
      <div className="vhead"><h2>{t("hr.title")}</h2></div>
      <HrTabs />
      {content}
    </AppShell>
  );
}
