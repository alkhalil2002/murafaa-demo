import { hrCandidates } from "@murafaa/sdk";
import { t, type MessageKey } from "@murafaa/i18n";
import { CANDIDATE_STAGES } from "@murafaa/rules";
import { DeniedPanel } from "@/components/denied-panel";
import { CandidateControls, CandidateForm } from "@/components/hr/hr-forms";
import { hrAccess } from "@/components/hr/hr-access";
import { HrHeader } from "../hr-header";

/** التوظيف (legacy /hr/recruitment): the candidate pipeline. */
export default async function RecruitmentPage() {
  const { api, canEdit } = await hrAccess();
  const list = (await hrCandidates({ client: api })).data?.data;
  return (
    <>
      <HrHeader />
      {!list ? (
        <DeniedPanel />
      ) : (
        <>
          {canEdit && <CandidateForm />}
          <div className="pipe">
            {CANDIDATE_STAGES.map((stage, si) => {
              const inStage = list.filter((c) => c.stage === stage);
              return (
                <div key={stage} className="kcol">
                  <h4>
                    {t(`hr.recruit.stage.${stage}` as MessageKey)}
                    <span>{inStage.length.toLocaleString("ar-SA")}</span>
                  </h4>
                  {inStage.length === 0 ? (
                    <div className="kempty">{t("common.none")}</div>
                  ) : (
                    inStage.map((c) => (
                      <div className="ktask" key={c.id}>
                        <div className="tt">{c.name}</div>
                        <div className="chips" style={{ marginBottom: 7 }}>
                          {c.roleTitle && <span className="chip">{c.roleTitle}</span>}
                          <span className="chip">{t(`leadSource.${c.source}` as MessageKey)}</span>
                        </div>
                        {canEdit && (
                          <CandidateControls
                            id={c.id}
                            canBack={si > 0}
                            canForward={si < CANDIDATE_STAGES.length - 1}
                          />
                        )}
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
