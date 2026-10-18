import { redirect } from "next/navigation";
import { LeadStage } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { getJourneySummary } from "@/server/journey";
import { PermissionError } from "@/lib/permissions/guard";
import { leadStageLabel } from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";

const arNum = (n: number) => n.toLocaleString("ar-SA");

const LEAD_FUNNEL_ORDER: LeadStage[] = [
  LeadStage.PROSPECT,
  LeadStage.FIRST_CONSULTATION,
  LeadStage.FEE_PROPOSAL_SENT,
  LeadStage.CONTRACTED,
];

function Group({ title, kpis }: { title: string; kpis: Array<[string, string]> }) {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <div className="kpis">
        {kpis.map(([label, value]) => (
          <div className="kpi" key={label}>
            <div className="v">{value}</div>
            <div className="l">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function JourneyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const s = await getJourneySummary(session);

    content = (
      <>
        <div className="panel">
          <div className="sub" style={{ marginBottom: 0 }}>{t("journey.hint")}</div>
        </div>

        <Group
          title={t("journey.group.contact")}
          kpis={[
            [t("journey.stage.firstContact"), arNum(s.firstContact)],
            [t("journey.stage.inboundChats"), arNum(s.inboundChats)],
          ]}
        />

        <Group
          title={t("journey.group.pipeline")}
          kpis={[
            [t("journey.stage.pipeline"), arNum(s.inPipeline)],
            [t("journey.stage.appointments"), arNum(s.appointments)],
            [t("journey.stage.contracted"), arNum(s.contracted)],
          ]}
        />

        <Group
          title={t("journey.group.caseManagement")}
          kpis={[
            [t("journey.stage.activeCases"), arNum(s.activeCases)],
            [t("journey.stage.followUps"), arNum(s.followUps)],
            [t("journey.stage.pendingApprovals"), arNum(s.pendingApprovals)],
          ]}
        />

        <Group
          title={t("journey.group.billing")}
          kpis={[
            [t("journey.stage.invoicesDue"), arNum(s.invoicesDue)],
            [t("journey.stage.uncollected"), formatSar(s.uncollectedMinor)],
          ]}
        />

        <Group
          title={t("journey.group.closing")}
          kpis={[
            [t("journey.stage.archived"), arNum(s.archivedCases)],
            [t("journey.stage.deadlines7"), arNum(s.deadlinesWithin7)],
            [t("journey.stage.unreadNotifications"), arNum(s.unreadNotifications)],
            [
              t("journey.stage.avgSatisfaction"),
              s.avgSatisfaction === null ? "—" : arNum(Math.round(s.avgSatisfaction * 10) / 10),
            ],
          ]}
        />

        <div className="panel">
          <h2 style={{ marginTop: 0 }}>{t("journey.funnel.title")}</h2>
          <div className="clist">
            {LEAD_FUNNEL_ORDER.map((stage) => (
              <div key={stage} className="approve-row">
                <span className="at">{leadStageLabel(stage)}</span>
                <span className="chip">{arNum(s.leadsByStage[stage])}</span>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("journey.title")}</h2>
        <span className="pill">{t("journey.pill")}</span>
      </div>
      {content}
    </AppShell>
  );
}
