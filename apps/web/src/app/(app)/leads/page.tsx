import { authCurrent, crmLeads } from "@murafaa/sdk";
import { LEAD_STAGES } from "@murafaa/rules";
import { formatSar, t, type MessageKey } from "@murafaa/i18n";
import { LeadCreateForm, LeadEditForm, LeadMoveControls } from "@/components/crm/lead-forms";
import { DeniedPanel } from "@/components/denied-panel";
import { serverApi } from "@/lib/api";

const arNum = (n: number) => n.toLocaleString("ar-SA");

export default async function LeadsPage() {
  const api = await serverApi();
  const [me, leadsRes] = await Promise.all([
    authCurrent({ client: api }),
    crmLeads({ client: api }),
  ]);
  const leads = leadsRes.data?.data;
  const level = me.data?.data.modules.CLIENTS;
  const canEdit = level === "EDIT" || level === "FULL";
  const canDelete = level === "FULL";

  return (
    <>
      <div className="vhead">
        <h2>{t("leads.title")}</h2>
        <span className="pill">{t("leads.pill", { n: arNum(leads?.length ?? 0) })}</span>
      </div>
      {!leads ? (
        <DeniedPanel />
      ) : (
        <>
          {canEdit && <LeadCreateForm />}
          <div className="pipe">
            {LEAD_STAGES.map((stage, si) => {
              const inStage = leads.filter((l) => l.stage === stage);
              return (
                <div key={stage} className="kcol">
                  <h4>
                    {t(`leadStage.${stage}` as MessageKey)}
                    <span>{arNum(inStage.length)}</span>
                  </h4>
                  {inStage.length === 0 ? (
                    <div className="kempty">{t("common.none")}</div>
                  ) : (
                    inStage.map((l) => (
                      <div className="ktask" key={l.id}>
                        <div className="tt">{l.name}</div>
                        <div className="chips" style={{ marginBottom: 7 }}>
                          <span className="chip">{t(`leadSource.${l.source}` as MessageKey)}</span>
                        </div>
                        <div className="tm">
                          <span style={{ fontWeight: 700, color: "var(--bench)" }}>
                            {l.expectedValue > 0 ? formatSar(l.expectedValue) : ""}
                          </span>
                          <span>{l.nextAction ?? ""}</span>
                        </div>
                        {canEdit && (
                          <LeadMoveControls
                            id={l.id}
                            canBack={si > 0}
                            canAdvance={si < LEAD_STAGES.length - 1}
                          />
                        )}
                        {canEdit && <LeadEditForm lead={l} canDelete={canDelete} />}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
