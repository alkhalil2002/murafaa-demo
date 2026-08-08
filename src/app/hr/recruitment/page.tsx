import { redirect } from "next/navigation";
import { CandidateStage, LeadSource, PermModule } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { HrTabs } from "@/components/hr-tabs";
import { getSession } from "@/lib/auth/session";
import { listCandidates } from "@/server/hr/recruitment";
import { PermissionError, canAction } from "@/lib/permissions/guard";
import { candidateStageLabel, leadSourceLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";
import { createCandidateAction, moveCandidateAction, deleteCandidateAction } from "./actions";

const PIPELINE: CandidateStage[] = [
  CandidateStage.APPLIED,
  CandidateStage.INTERVIEW,
  CandidateStage.OFFER,
  CandidateStage.HIRED,
];

export default async function RecruitmentPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  try {
    const [candidates, canEdit] = await Promise.all([
      listCandidates(session),
      canAction(session, PermModule.HR, "edit"),
    ]);

    content = (
      <>
        {canEdit && (
          <details className="panel">
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>{t("hr.recruit.addCandidate")}</summary>
            <form action={createCandidateAction} style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12, alignItems: "flex-end" }}>
              <label className="field" style={{ flex: 1, minWidth: 160 }}>
                <span>{t("hr.recruit.name")}</span>
                <input type="text" name="name" required />
              </label>
              <label className="field" style={{ flex: 1, minWidth: 200 }}>
                <span>{t("hr.recruit.roleTitle")}</span>
                <input type="text" name="roleTitle" />
              </label>
              <label className="field" style={{ minWidth: 140 }}>
                <span>{t("hr.recruit.source")}</span>
                <select name="source" defaultValue={LeadSource.OTHER}>
                  {Object.values(LeadSource).map((s) => (
                    <option key={s} value={s}>
                      {leadSourceLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="act b-add">
                {t("hr.recruit.save")}
              </button>
            </form>
          </details>
        )}

        <div className="pipe">
          {PIPELINE.map((stage, si) => {
            const inStage = candidates.filter((c) => c.stage === stage);
            return (
              <div key={stage} className="kcol">
                <h4>
                  {candidateStageLabel(stage)}
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
                        <span className="chip">{leadSourceLabel(c.source)}</span>
                      </div>
                      {canEdit && (
                        <div className="lctrl">
                          {si > 0 && (
                            <form action={moveCandidateAction} style={{ display: "contents" }}>
                              <input type="hidden" name="id" value={c.id} />
                              <input type="hidden" name="dir" value="-1" />
                              <button type="submit">{t("leads.back")}</button>
                            </form>
                          )}
                          {si < PIPELINE.length - 1 && (
                            <form action={moveCandidateAction} style={{ display: "contents" }}>
                              <input type="hidden" name="id" value={c.id} />
                              <input type="hidden" name="dir" value="1" />
                              <button type="submit" className="fwd">
                                {t("leads.advance")}
                              </button>
                            </form>
                          )}
                          <form action={deleteCandidateAction} style={{ display: "contents" }}>
                            <input type="hidden" name="id" value={c.id} />
                            <button type="submit">{t("hr.recruit.delete")}</button>
                          </form>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <div className="vhead"><h2>{t("hr.title")}</h2></div>
      <HrTabs />
      {content}
    </AppShell>
  );
}
