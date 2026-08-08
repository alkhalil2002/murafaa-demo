import { redirect } from "next/navigation";
import { LeadStage, PermModule } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { listLeads } from "@/server/leads";
import { PermissionError, canAction } from "@/lib/permissions/guard";
import { leadSourceLabel, leadStageLabel } from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";
import { moveLeadAction, convertLeadAction } from "./actions";

const PIPELINE: LeadStage[] = [
  LeadStage.PROSPECT,
  LeadStage.FIRST_CONSULTATION,
  LeadStage.FEE_PROPOSAL_SENT,
  LeadStage.CONTRACTED,
];

export default async function LeadsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  let total = 0;
  try {
    const [leads, canEdit] = await Promise.all([
      listLeads(session),
      canAction(session, PermModule.CLIENTS, "edit"),
    ]);
    total = leads.length;
    content = (
      <div className="pipe">
        {PIPELINE.map((stage, si) => {
          const inStage = leads.filter((l) => l.stage === stage);
          return (
            <div key={stage} className="kcol">
              <h4>
                {leadStageLabel(stage)}
                <span>{inStage.length.toLocaleString("ar-SA")}</span>
              </h4>
              {inStage.length === 0 ? (
                <div className="kempty">{t("common.none")}</div>
              ) : (
                inStage.map((l) => (
                  <div className="ktask" key={l.id}>
                    <div className="tt">{l.name}</div>
                    <div className="chips" style={{ marginBottom: 7 }}>
                      <span className="chip">{leadSourceLabel(l.source)}</span>
                    </div>
                    <div className="tm">
                      <span style={{ fontWeight: 700, color: "var(--bench)" }}>
                        {l.expectedValue > 0 ? formatSar(l.expectedValue) : ""}
                      </span>
                      <span>{l.nextAction ?? ""}</span>
                    </div>
                    {canEdit && (
                      <div className="lctrl">
                        {si > 0 && (
                          <form action={moveLeadAction} style={{ display: "contents" }}>
                            <input type="hidden" name="id" value={l.id} />
                            <input type="hidden" name="dir" value="-1" />
                            <button type="submit">{t("leads.back")}</button>
                          </form>
                        )}
                        {si < PIPELINE.length - 1 ? (
                          <form action={moveLeadAction} style={{ display: "contents" }}>
                            <input type="hidden" name="id" value={l.id} />
                            <input type="hidden" name="dir" value="1" />
                            <button type="submit" className="fwd">
                              {t("leads.advance")}
                            </button>
                          </form>
                        ) : (
                          <form action={convertLeadAction} style={{ display: "contents" }}>
                            <input type="hidden" name="id" value={l.id} />
                            <button type="submit" className="conv">
                              {t("leads.convert")}
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return (
    <AppShell>
      <div className="vhead">
        <h2>{t("leads.title")}</h2>
        <span className="pill">{t("leads.pill", { n: total.toLocaleString("ar-SA") })}</span>
      </div>
      {content}
    </AppShell>
  );
}
