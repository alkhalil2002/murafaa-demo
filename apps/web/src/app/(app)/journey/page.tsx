import { overviewJourney } from "@murafaa/sdk";
import { LEAD_STAGES } from "@murafaa/rules";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

const arNum = (n: number) => n.toLocaleString("ar-SA");

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

/** رحلة العميل (legacy journey page): every number is a live read from its module. */
export default async function JourneyPage() {
  const api = await serverApi();
  const s = (await overviewJourney({ client: api })).data?.data;
  return (
    <>
      <div className="vhead">
        <h2>{t("journey.title")}</h2>
        <span className="pill">{t("journey.pill")}</span>
      </div>
      {!s ? (
        <DeniedPanel />
      ) : (
        <>
          <div className="panel">
            <div className="sub" style={{ marginBottom: 0 }}>
              {t("journey.hint")}
            </div>
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
              [t("journey.stage.uncollected"), formatSar(s.uncollected)],
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
              {LEAD_STAGES.map((stage) => (
                <div key={stage} className="approve-row">
                  <span className="at">{t(`leadStage.${stage}` as MessageKey)}</span>
                  <span className="chip">{arNum(s.leadsByStage[stage] ?? 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
