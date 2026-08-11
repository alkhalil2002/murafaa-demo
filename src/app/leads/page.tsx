import { redirect } from "next/navigation";
import { LeadStage, PermModule } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { listLeads } from "@/server/leads";
import { PermissionError, canAction } from "@/lib/permissions/guard";
import { leadSourceLabel, leadStageLabel } from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { t } from "@/lib/i18n";
import { DndCard, DndColumn } from "@/components/dnd-board";
import { moveLeadAction, setLeadStageAction, convertLeadAction, createLeadAction, updateLeadAction, deleteLeadAction } from "./actions";
import { halalasToRiyals } from "@/lib/money";

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
      <>
        {canEdit && (
          <div className="panel">
            <form action={createLeadAction} className="three" style={{ alignItems: "flex-end" }}>
              <div className="field">
                <label>{t("leads.new")}</label>
                <input type="text" name="name" placeholder={t("leads.namePlaceholder")} required />
              </div>
              <div className="field">
                <label>{t("leads.source")}</label>
                <select name="source" defaultValue="">
                  <option value="">—</option>
                  {["WEBSITE", "REFERRAL", "WHATSAPP", "EXHIBITION", "OTHER"].map((s) => (
                    <option key={s} value={s}>
                      {leadSourceLabel(s as never)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t("leads.expectedValue")}</label>
                <input type="number" name="expectedValue" min="0" step="0.01" />
              </div>
              <div className="field">
                <label>{t("leads.phonePlaceholder")}</label>
                <input type="text" name="phone" placeholder={t("leads.phonePlaceholder")} />
              </div>
              <div className="field">
                <label>{t("leads.nextAction")}</label>
                <input type="text" name="nextAction" />
              </div>
              <button type="submit" className="act b-add">
                {t("leads.addSubmit")}
              </button>
            </form>
          </div>
        )}
        <div className="pipe">
        {PIPELINE.map((stage, si) => {
          const inStage = leads.filter((l) => l.stage === stage);
          return (
            <DndColumn
              key={stage}
              className="kcol"
              target={stage}
              field="stage"
              onMove={setLeadStageAction}
            >
              <h4>
                {leadStageLabel(stage)}
                <span>{inStage.length.toLocaleString("ar-SA")}</span>
              </h4>
              {inStage.length === 0 ? (
                <div className="kempty">{t("common.none")}</div>
              ) : (
                inStage.map((l) => (
                  <DndCard className="ktask" key={l.id} id={l.id}>
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
                    {canEdit && (
                      <details style={{ marginTop: 6 }}>
                        <summary style={{ cursor: "pointer", fontSize: 14.375, color: "var(--bench)" }}>
                          {t("leads.edit")}
                        </summary>
                        <form action={updateLeadAction} style={{ marginTop: 6, display: "grid", gap: 4 }}>
                          <input type="hidden" name="id" value={l.id} />
                          <input type="text" name="name" defaultValue={l.name} placeholder={t("leads.namePlaceholder")} required />
                          <input type="text" name="phone" defaultValue={l.phone ?? ""} placeholder={t("leads.phonePlaceholder")} />
                          <input
                            type="number"
                            name="expectedValue"
                            min="0"
                            step="0.01"
                            defaultValue={l.expectedValue > 0 ? halalasToRiyals(l.expectedValue) : ""}
                          />
                          <input type="text" name="nextAction" defaultValue={l.nextAction ?? ""} />
                          <div style={{ display: "flex", gap: 6 }}>
                            <button type="submit" className="tinybtn">
                              {t("leads.save")}
                            </button>
                          </div>
                        </form>
                        <form action={deleteLeadAction} style={{ marginTop: 4 }}>
                          <input type="hidden" name="id" value={l.id} />
                          <button type="submit" className="tinybtn del">
                            {t("leads.delete")}
                          </button>
                        </form>
                      </details>
                    )}
                  </DndCard>
                ))
              )}
            </DndColumn>
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
      <div className="vhead">
        <h2>{t("leads.title")}</h2>
        <span className="pill">{t("leads.pill", { n: total.toLocaleString("ar-SA") })}</span>
      </div>
      {content}
    </AppShell>
  );
}
