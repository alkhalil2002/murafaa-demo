import { redirect } from "next/navigation";
import Link from "next/link";
import { ConflictSeverity, ConflictStatus, PermModule, CaseOutcome, CaseStatus, ApprovalStage, HearingKind, DocParty, DocSource, ProcStage, ExecutionFileStatus, CaseEventType, FeeType, ClientCommunicationType } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { getCase, listAssignableUsers } from "@/server/cases";
import { listDocuments } from "@/server/documents";
import { getFeeAgreement } from "@/server/fees";
import { feeNet } from "@/lib/finance/core";
import { halalasToRiyals } from "@/lib/money";
import { listInvoices } from "@/server/invoices";
import { listExpenses, listTimeEntries } from "@/server/expenses";
import { listApprovals } from "@/server/approvals";
import { listProcedureRequests, PROC_REQUEST_TYPES } from "@/server/procedure-requests";
import { listClientCommunications } from "@/server/communications";
import { addClientCommunicationAction, deleteClientCommunicationAction } from "../communication-actions";
import { listCaseMessages } from "@/server/messages";
import { sendCaseMessageAction } from "../message-actions";
import { listInteractions } from "@/server/ai";
import { askAction } from "@/app/ai/actions";
import { AiAnswer } from "@/components/ai-answer";
import { listContracts } from "@/server/contracts";
import { addContractAction, toggleContractSignedAction, deleteContractAction } from "../contract-actions";
import { getExecution } from "@/server/execution";
import { getHearingActions } from "@/server/hearings";
import { listClients } from "@/server/clients";
import { renderConflictMessage } from "@/lib/conflict/service";
import { PermissionError, canAction } from "@/lib/permissions/guard";
import {
  docSourceLabel,
  expenseCategoryLabel,
  feeTypeLabel,
  invoiceStatusLabel,
  approvalStageLabel,
  procedureRequestStatusLabel,
  caseEventTypeLabel,
  CASE_EVENT_ICON,
  clientCommunicationTypeLabel,
  docPartyLabel,
  executionFileStatusLabel,
  executionProcStatusLabel,
} from "@/lib/labels";
import { shareDocumentAction, deleteDocumentAction, clearOpeningPackageAction } from "@/app/documents/actions";
import { uploadDocumentAction } from "@/app/documents/upload-actions";
import {
  addProcedureRequestAction,
  cycleProcedureRequestStatusAction,
  deleteProcedureRequestAction,
} from "../procedure-request-actions";
import { setOutcomeAction, generateFeeInvoiceAction, saveFeeAgreementAction } from "../actions";
import { createApprovalAction, advanceApprovalAction, rejectApprovalAction, deleteApprovalAction } from "../approvals-actions";
import {
  recordHearingAction,
  setNextHearingAction,
  updateHearingAction,
  deleteHearingAction,
  addHearingReminderAction,
  addHearingTaskAction,
  updateHearingReminderAction,
  deleteHearingReminderAction,
  updateHearingTaskAction,
  deleteHearingTaskAction,
  escalateHearingReminderAction,
  requestReportApprovalAction,
  cancelReportApprovalRequestAction,
  approveReportAction,
  rejectReportAction,
  generateHearingReportPdfAction,
} from "../hearing-actions";
import { updateCaseAction, assignUserAction, unassignUserAction } from "../edit-actions";
import { promoteStageAction, remandStageAction, endProcedureAction, reopenProcedureAction } from "../proc-actions";
import { toggleChecklistAction, setCsatAction, requestReferralAction, archiveCaseAction } from "../closing-actions";
import {
  openExecutionAction,
  setExecutionStatusAction,
  recordCollectionAction,
  addExecutionProcedureAction,
  cycleExecutionProcedureAction,
} from "../execution-actions";
import { NajizPicker, NajizFieldLabel } from "@/components/cases/najiz-picker";
import { RolePicker } from "@/components/cases/role-picker";
import { HearingWizard } from "@/components/cases/hearing-wizard";
import { CLOSING_CHECKLIST_ITEMS } from "@/server/cases";
import { SAUDI_CITIES } from "@/lib/cities";
import {
  caseStatusLabel,
  hearingKindLabel,
  hearingStatusLabel,
  partyRoleLabel,
  outcomeLabel,
  stageLabel,
} from "@/lib/labels";
import { formatSar } from "@/lib/money";
import { daysLeft, daysAgo } from "@/lib/dates";
import { t, type MessageKey } from "@/lib/i18n";

const HEARING_KINDS = Object.values(HearingKind);
const PROC_STAGES = Object.values(ProcStage);
const DOC_PARTIES = Object.values(DocParty);
const DOC_SOURCES = Object.values(DocSource);

/** Preset prompts for the case assistant's "smart tools" row — each runs through
 * the same real embed→retrieve→generate→citation-gate pipeline as a typed
 * question (src/server/ai.ts askAssistant); none of these are canned/fabricated
 * output, only the prompt text is preset. */
const AI_SMART_TOOLS = [
  { key: "summary", label: "📋 تلخيص القضية", question: "لخّص هذه القضية بإيجاز: الوقائع، الأطراف، المرحلة الحالية، وأهم النقاط." },
  { key: "opponent", label: "🛡 تحليل مذكرة الخصم", question: "حلّل دفوع الخصم في هذه القضية واقترح ردًا عليها." },
  { key: "draft", label: "📝 مسودة مذكرة", question: "أعدّ مسودة أولية لمذكرة جوابية في هذه القضية بناءً على وقائعها الحالية." },
  { key: "odds", label: "📊 تقدير احتمالية النجاح", question: "قدّر احتمالية نجاح موقفنا في هذه القضية بناءً على وقائعها ومرحلتها الحالية." },
  { key: "stage", label: "🧭 نصائح حسب المرحلة", question: "ما النصائح والخطوات الإجرائية الموصى بها في المرحلة الحالية لهذه القضية؟" },
  { key: "dates", label: "🗓 مراجعة التواريخ والمهل", question: "راجع التواريخ والمهل الإجرائية لهذه القضية ونبّه لأي مهلة وشيكة أو فائتة." },
  { key: "precedents", label: "⚖ سوابق مشابهة", question: "هل توجد سوابق قضائية أو أنظمة ذات صلة بموضوع هذه القضية؟" },
] as const;
const EXEC_FILE_STATUSES = Object.values(ExecutionFileStatus);

function fmt(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "—";
}

function relTime(d: Date | null | undefined): string {
  if (!d) return "—";
  const n = daysAgo(d);
  if (n <= 0) return t("common.today");
  return t("common.daysAgo", { n: n.toLocaleString("ar-SA") });
}

const TABS = [
  { key: "overview", label: () => t("cases.tab.overview") },
  { key: "hearings", label: () => t("cases.tab.hearings") },
  { key: "parties", label: () => t("cases.tab.parties") },
  { key: "assistant", label: () => t("cases.tab.assistant") },
  { key: "chat", label: () => t("cases.tab.chat") },
  { key: "documents", label: () => t("cases.tab.documents") },
  { key: "contracts", label: () => t("cases.tab.contracts") },
  { key: "finance", label: () => t("cases.tab.finance") },
  { key: "approvals", label: () => t("cases.tab.approvals") },
  { key: "execution", label: () => t("cases.tab.execution") },
  { key: "events", label: () => t("cases.tab.events") },
  { key: "closing", label: () => t("cases.tab.closing") },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; evf?: string; docsrc?: string; docparty?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const { tab: tabParam, evf: eventFilterParam, docsrc: docSrcParam, docparty: docPartyParam } = await searchParams;
  const tab: TabKey = (TABS.find((x) => x.key === tabParam)?.key ?? "overview") as TabKey;

  let content: React.ReactNode;
  try {
    const c = await getCase(session, id);
    const activeFlags = c.conflictFlags.filter((f) => f.status === ConflictStatus.ACTIVE);
    const anyHigh = activeFlags.some((f) => f.severity === ConflictSeverity.HIGH);
    const messages = await Promise.all(activeFlags.map((f) => renderConflictMessage(session, f)));
    const canEditCase = await canAction(session, PermModule.CASES, "edit");
    const canApproveReports = await canAction(session, PermModule.CASES, "delete");
    const canViewFinance = await canAction(session, PermModule.FINANCE, "view");
    const canEditDocuments = await canAction(session, PermModule.DOCUMENTS, "edit");
    const upcoming = c.hearings.filter((h) => h.status === "UPCOMING").slice(0, 1)[0];
    const opponentRole = c.clientRole === "PLAINTIFF" ? "DEFENDANT" : c.clientRole === "DEFENDANT" ? "PLAINTIFF" : null;

    let tabBody: React.ReactNode;
    switch (tab) {
      case "overview": {
        const stageIdx = PROC_STAGES.indexOf(c.stage);
        const procRequestsByStage = await listProcedureRequests(session, id);
        let openingDocs: Awaited<ReturnType<typeof listDocuments>> = [];
        try {
          openingDocs = (await listDocuments(session, id)).filter((d) => d.source === "OPENING");
        } catch {
          // DOCUMENTS module not visible to this role — skip the opening-package card.
        }
        let clients: Awaited<ReturnType<typeof listClients>> = [];
        let clientsAvailable = true;
        try {
          clients = await listClients(session);
        } catch {
          clientsAvailable = false;
        }
        const overviewAssignableUsers = canEditCase ? await listAssignableUsers(session) : [];
        const unassignedUsers = overviewAssignableUsers.filter(
          (u) => !c.assignees.some((a) => a.userId === u.id),
        );
        tabBody = (
          <>
            <div className="kpis">
              <Field label={t("cases.client")} value={c.client?.name ?? "—"} />
              <Field label={t("cases.opponent")} value={c.opposingParty ?? "—"} />
              <Field label={t("cases.stage")} value={stageLabel(c.effectiveStage)} />
              <Field label={t("cases.status")} value={caseStatusLabel(c.status)} />
              <Field
                label={t("cases.classification")}
                value={[c.najizMainClass, c.najizSubClass, c.najizCaseType].filter(Boolean).join(" · ") || "—"}
              />
              <Field label={t("cases.judgmentDate")} value={fmt(c.judgmentDate)} />
              <Field label={t("cases.objectionDue")} value={fmt(c.objectionDueAt)} />
              <Field
                label={t("cases.nextHearing")}
                value={upcoming ? fmt(upcoming.hearingDate) : t("common.none")}
              />
            </div>

            <Panel n={t("cases.tag.dates")} title={t("cases.proc.title")}>
              <div className="statusbar">
                {PROC_STAGES.map((s, i) => (
                  <div
                    key={s}
                    className={`stp ${c.procEnded ? (i <= stageIdx ? "done" : "") : i < stageIdx ? "done" : i === stageIdx ? "cur" : ""}`}
                  >
                    {stageLabel(s)}
                  </div>
                ))}
              </div>
              <div className="chips" style={{ marginBottom: 12 }}>
                {c.procEnded ? (
                  <span className="chip st done">
                    {t("cases.proc.ended")}: {stageLabel(c.stage)}
                    {c.procResult ? ` — ${c.procResult}` : ""}
                  </span>
                ) : (
                  <span className="chip">
                    {t("cases.proc.current")}: {stageLabel(c.stage)}
                  </span>
                )}
              </div>
              {canEditCase && (
                <div className="actions">
                  {!c.procEnded ? (
                    <>
                      {stageIdx > 0 && (
                        <form action={remandStageAction}>
                          <input type="hidden" name="caseId" value={id} />
                          <button type="submit" className="tinybtn">
                            {t("cases.proc.remand")}
                          </button>
                        </form>
                      )}
                      {stageIdx < PROC_STAGES.length - 1 && (
                        <form action={promoteStageAction}>
                          <input type="hidden" name="caseId" value={id} />
                          <button type="submit" className="tinybtn" style={{ background: "var(--bench)", color: "#fff" }}>
                            {t("cases.proc.promote")}
                          </button>
                        </form>
                      )}
                      <form action={endProcedureAction} style={{ display: "flex", gap: 6, flex: 1, minWidth: 220 }}>
                        <input type="hidden" name="caseId" value={id} />
                        <input type="text" name="result" placeholder={t("cases.proc.resultPlaceholder")} style={{ flex: 1 }} />
                        <button type="submit" className="tinybtn del">
                          {t("cases.proc.end")}
                        </button>
                      </form>
                    </>
                  ) : (
                    <form action={reopenProcedureAction}>
                      <input type="hidden" name="caseId" value={id} />
                      <button type="submit" className="tinybtn">
                        {t("cases.proc.reopen")}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </Panel>

            <Panel n={t("cases.tag.dates")} title={t("cases.procRequests.title")}>
              {procRequestsByStage.size === 0 ? (
                <Empty>{t("common.none")}</Empty>
              ) : (
                [...procRequestsByStage.entries()].map(([stIdx, reqs]) => (
                  <div key={stIdx} style={{ marginBottom: 14 }}>
                    <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                      {t("cases.procRequests.stageGroup", {
                        stage: stageLabel(PROC_STAGES[stIdx] ?? ProcStage.RECONCILIATION),
                      })}{" "}
                      (
                      {reqs.length.toLocaleString("ar-SA")})
                    </div>
                    {reqs.map((r) => (
                      <div className="approve-row" key={r.id} style={{ flexWrap: "wrap" }}>
                        <span className="chip">
                          {r.party === "OURS" ? t("cases.procRequests.usParty") : t("cases.procRequests.opponentParty")}
                        </span>
                        <span className="at">
                          {r.type ?? r.text}
                          {r.type && r.text && r.text !== r.type && <span className="chip"> {r.text}</span>}
                        </span>
                        <span className="chip st">{procedureRequestStatusLabel(r.status)}</span>
                        {canEditCase && (
                          <>
                            <form action={cycleProcedureRequestStatusAction}>
                              <input type="hidden" name="caseId" value={id} />
                              <input type="hidden" name="requestId" value={r.id} />
                              <button type="submit" className="tinybtn">
                                {t("cases.procRequests.cycleStatus")}
                              </button>
                            </form>
                            <form action={deleteProcedureRequestAction}>
                              <input type="hidden" name="caseId" value={id} />
                              <input type="hidden" name="requestId" value={r.id} />
                              <button type="submit" className="tinybtn del">
                                {t("cases.hearings.delete")}
                              </button>
                            </form>
                          </>
                        )}
                        <div style={{ width: "100%", fontSize: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                          {r.documents.length === 0 ? (
                            <span className="sub">{t("cases.procRequests.noAttachments")}</span>
                          ) : (
                            r.documents.map((doc) => (
                              <span className="chip" key={doc.id}>
                                📎 {doc.fileName} ·{" "}
                                {doc.procedureDocRole === "RESULT"
                                  ? t("cases.procRequests.resultDoc")
                                  : t("cases.procRequests.requestDoc")}
                                {canEditDocuments && (
                                  <form action={deleteDocumentAction} style={{ display: "inline" }}>
                                    <input type="hidden" name="id" value={doc.id} />
                                    <input type="hidden" name="caseId" value={id} />
                                    <button type="submit" className="tinybtn del" style={{ marginInlineStart: 4 }}>
                                      ×
                                    </button>
                                  </form>
                                )}
                              </span>
                            ))
                          )}
                          {canEditDocuments && (
                            <>
                              <form
                                action={uploadDocumentAction}
                                encType="multipart/form-data"
                                style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
                              >
                                <input type="hidden" name="caseId" value={id} />
                                <input type="hidden" name="procedureRequestId" value={r.id} />
                                <input type="hidden" name="procedureDocRole" value="REQUEST" />
                                <input type="hidden" name="source" value="PROCEDURAL_REQUEST" />
                                <input type="file" name="file" required style={{ fontSize: 11, maxWidth: 130 }} />
                                <button type="submit" className="tinybtn">
                                  {t("cases.procRequests.attachRequest")}
                                </button>
                              </form>
                              <form
                                action={uploadDocumentAction}
                                encType="multipart/form-data"
                                style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
                              >
                                <input type="hidden" name="caseId" value={id} />
                                <input type="hidden" name="procedureRequestId" value={r.id} />
                                <input type="hidden" name="procedureDocRole" value="RESULT" />
                                <input type="hidden" name="source" value="PROCEDURAL_REQUEST" />
                                <input type="file" name="file" required style={{ fontSize: 11, maxWidth: 130 }} />
                                <button type="submit" className="tinybtn">
                                  {t("cases.procRequests.attachResult")}
                                </button>
                              </form>
                            </>
                          )}
                        </div>
                        {r.log.length > 0 && (
                          <div style={{ width: "100%", fontSize: 11.5, color: "var(--ink-soft)" }}>
                            {r.log.map((ev) => (
                              <div key={ev.id}>
                                · {ev.description} ({relTime(ev.occurredAt)})
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              )}
              {canEditCase && (
                <form
                  action={addProcedureRequestAction}
                  style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}
                >
                  <input type="hidden" name="caseId" value={id} />
                  <select name="stageIndex" defaultValue={String(stageIdx)}>
                    {PROC_STAGES.map((s, i) => (
                      <option key={s} value={i}>
                        {stageLabel(s)}
                      </option>
                    ))}
                  </select>
                  <select name="party" defaultValue="OURS">
                    {DOC_PARTIES.filter((p) => p !== "COURT").map((p) => (
                      <option key={p} value={p}>
                        {docPartyLabel(p)}
                      </option>
                    ))}
                  </select>
                  <select name="type" defaultValue="" required style={{ minWidth: 160 }}>
                    <option value="" disabled>
                      {t("cases.procRequests.typeLabel")}
                    </option>
                    {PROC_REQUEST_TYPES.map((ty) => (
                      <option key={ty} value={ty}>
                        {ty}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    name="text"
                    placeholder={t("cases.procRequests.textPlaceholder")}
                    style={{ flex: 1, minWidth: 160 }}
                  />
                  <button type="submit" className="tinybtn">
                    {t("cases.procRequests.add")}
                  </button>
                </form>
              )}
            </Panel>

            <Panel
              n={t("cases.tag.documents")}
              title={`${t("cases.openingPackage.title")} — ${t("cases.openingPackage.itemCount", { n: openingDocs.length.toLocaleString("ar-SA") })}`}
            >
              <div className="sub" style={{ marginBottom: 10 }}>
                {t("cases.openingPackage.hint")}
              </div>
              {openingDocs.length === 0 ? (
                <Empty>{t("documents.empty")}</Empty>
              ) : (
                openingDocs.map((d) => (
                  <div className="approve-row" key={d.id}>
                    <span className="ndot" style={{ background: "var(--bench)" }} />
                    <span className="at">
                      📄 {d.fileName}
                      <span className="chip"> {docPartyLabel(d.party ?? "OURS")}</span>
                      {d.needsOcr && <span className="chip"> OCR</span>}
                      {d.extractedText && <span className="chip st"> {t("cases.openingPackage.viewExtractedText")}</span>}
                    </span>
                    <a href={`/api/documents/${d.id}/download`} className="tinybtn">
                      {t("documents.download")}
                    </a>
                    {canEditDocuments && (
                      <>
                        <form action={shareDocumentAction}>
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="caseId" value={id} />
                          <button type="submit" className="tinybtn">
                            {d.clientVisible ? t("documents.unshare") : t("documents.share")}
                          </button>
                        </form>
                        <form action={deleteDocumentAction}>
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="caseId" value={id} />
                          <button type="submit" className="tinybtn del">
                            {t("documents.delete")}
                          </button>
                        </form>
                      </>
                    )}
                  </div>
                ))
              )}
              {canEditDocuments && (
                <form
                  action={uploadDocumentAction}
                  encType="multipart/form-data"
                  style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}
                >
                  <input type="hidden" name="caseId" value={id} />
                  <input type="hidden" name="source" value="OPENING" />
                  <select name="party" defaultValue="OPPONENT">
                    {DOC_PARTIES.map((p) => (
                      <option key={p} value={p}>
                        {docPartyLabel(p)}
                      </option>
                    ))}
                  </select>
                  <input type="text" name="docType" placeholder={t("documents.docType")} />
                  <input type="file" name="file" required />
                  <button type="submit" className="tinybtn">
                    {t("cases.openingPackage.add")}
                  </button>
                </form>
              )}
              {openingDocs.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {canEditCase && (
                    <form action={createApprovalAction}>
                      <input type="hidden" name="caseId" value={id} />
                      <input type="hidden" name="title" value={t("cases.openingPackage.sendForApprovalTitle")} />
                      <button type="submit" className="tinybtn">
                        {t("cases.openingPackage.sendForApproval")}
                      </button>
                    </form>
                  )}
                  {canEditDocuments && (
                    <form action={clearOpeningPackageAction}>
                      <input type="hidden" name="caseId" value={id} />
                      <button type="submit" className="tinybtn del">
                        {t("cases.openingPackage.clearAll")}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </Panel>

            {canEditCase && (
              <div className="panel">
                <h2 style={{ marginTop: 0 }}>
                  <span className="n">{t("cases.tag.parties")}</span> {t("cases.edit.title")}
                </h2>
                <form action={updateCaseAction}>
                  <input type="hidden" name="caseId" value={id} />
                  <div className="two">
                    <div className="field">
                      <label>{t("cases.new.number")}</label>
                      <input type="text" name="number" defaultValue={c.number} required />
                    </div>
                    <div className="field">
                      <label>{t("cases.new.title.field")}</label>
                      <input type="text" name="title" defaultValue={c.title} required />
                    </div>
                  </div>
                  <div className="field">
                    <label>{t("cases.edit.status")}</label>
                    <select name="status" defaultValue={c.status}>
                      {Object.values(CaseStatus).map((s) => (
                        <option key={s} value={s}>
                          {caseStatusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>{t("cases.new.roleLabel")}</label>
                  </div>
                  <RolePicker defaultValue={c.clientRole} />
                  <div className="two">
                    <div className="field">
                      <label>{t("cases.new.client")}</label>
                      {clientsAvailable ? (
                        <select name="clientId" defaultValue={c.clientId ?? ""}>
                          <option value="">{t("cases.new.clientNone")}</option>
                          {clients.map((cl) => (
                            <option key={cl.id} value={cl.id}>
                              {cl.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="sub" style={{ marginBottom: 0 }}>
                          {t("cases.new.clientsUnavailable")}
                        </div>
                      )}
                    </div>
                    <div className="field">
                      <label>{t("cases.new.opponent")}</label>
                      <input type="text" name="opposingParty" defaultValue={c.opposingParty ?? ""} />
                    </div>
                  </div>
                  <div className="field">
                    <label>{t("cases.edit.entity")}</label>
                    <input type="text" name="entity" defaultValue={c.entity ?? ""} />
                  </div>
                  <div className="field">
                    <NajizFieldLabel />
                    <NajizPicker
                      initialMain={c.najizMainClass}
                      initialSub={c.najizSubClass}
                      initialType={c.najizCaseType}
                    />
                  </div>
                  <div className="field">
                    <label>{t("cases.new.city")}</label>
                    <select name="city" defaultValue={c.city ?? SAUDI_CITIES[0]}>
                      {SAUDI_CITIES.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="actions">
                    <button type="submit" className="act b-add">
                      {t("cases.edit.save")}
                    </button>
                  </div>
                </form>

                <div className="field" style={{ marginTop: 14 }}>
                  <label>{t("cases.edit.assignees")}</label>
                  <div className="chips">
                    {c.assignees.length === 0 ? (
                      <span className="sub">{t("common.none")}</span>
                    ) : (
                      c.assignees.map((a) => (
                        <form action={unassignUserAction} key={a.userId} style={{ display: "inline" }}>
                          <input type="hidden" name="caseId" value={id} />
                          <input type="hidden" name="userId" value={a.userId} />
                          <input type="hidden" name="userName" value={a.user.name} />
                          <button type="submit" className="chip" style={{ cursor: "pointer" }}>
                            {a.user.name} ×
                          </button>
                        </form>
                      ))
                    )}
                  </div>
                  {unassignedUsers.length > 0 && (
                    <form action={assignUserAction} style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <input type="hidden" name="caseId" value={id} />
                      <select name="userId" defaultValue="" style={{ flex: 1 }}>
                        <option value="" disabled>
                          {t("cases.edit.addAssignee")}
                        </option>
                        {unassignedUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="tinybtn">
                        {t("cases.edit.addAssignee")}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </>
        );
        break;
      }
      case "hearings": {
        const dlColor = (dl: number) => (dl < 0 || dl <= 2 ? "var(--advocate)" : dl <= 7 ? "var(--gold)" : "var(--ok)");
        const upcoming = c.hearings.find((h) => h.status === "UPCOMING");
        const held = c.hearings
          .filter((h) => h.status === "HELD")
          .sort((a, b) => b.hearingDate.getTime() - a.hearingDate.getTime());
        const assignableUsers = canEditCase ? await listAssignableUsers(session) : [];
        const hearingActionsById = canEditCase
          ? Object.fromEntries(
              await Promise.all(
                held.map(async (h) => [h.id, await getHearingActions(session, id, h.id)] as const),
              ),
            )
          : {};
        const procRequestsByHearing = new Map<string, { id: string; party: string; type: string | null; text: string }[]>();
        for (const reqs of (await listProcedureRequests(session, id)).values()) {
          for (const r of reqs) {
            if (!r.hearingId) continue;
            const list = procRequestsByHearing.get(r.hearingId) ?? [];
            list.push({ id: r.id, party: r.party, type: r.type, text: r.text });
            procRequestsByHearing.set(r.hearingId, list);
          }
        }

        tabBody = (
          <>
            {canEditCase && (
              <div className="panel">
                <h2 style={{ marginTop: 0 }}>
                  <span className="n">{t("cases.tag.dates")}</span>{" "}
                  {upcoming ? t("cases.nextHearing") : t("cases.hearings.schedule")}
                </h2>
                {upcoming ? (
                  <div
                    className="approve-row"
                    style={{ borderStyle: "dashed", borderWidth: 1, borderColor: dlColor(daysLeft(upcoming.hearingDate)), borderRadius: 12, padding: "10px 14px" }}
                  >
                    <span className="ndot" style={{ background: dlColor(daysLeft(upcoming.hearingDate)) }} />
                    <span className="at">
                      {t("cases.hearings.upcomingBadge")}
                      <span className="chip"> {fmt(upcoming.hearingDate)}</span>
                    </span>
                    <a href="#record-hearing-form" className="tinybtn" style={{ background: "var(--bench)", color: "#fff" }}>
                      {t("cases.hearings.recordNow")}
                    </a>
                    <details style={{ display: "inline-block" }}>
                      <summary className="tinybtn" style={{ display: "inline-block", cursor: "pointer" }}>
                        {t("cases.hearings.editDate")}
                      </summary>
                      <form action={setNextHearingAction} style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <input type="hidden" name="caseId" value={id} />
                        <input type="date" name="date" defaultValue={fmt(upcoming.hearingDate)} required />
                        <button type="submit" className="tinybtn" style={{ background: "var(--bench)", color: "#fff" }}>
                          {t("common.save")}
                        </button>
                      </form>
                    </details>
                    <form action={deleteHearingAction}>
                      <input type="hidden" name="caseId" value={id} />
                      <input type="hidden" name="hearingId" value={upcoming.id} />
                      <button type="submit" className="tinybtn del">
                        {t("cases.hearings.delete")}
                      </button>
                    </form>
                  </div>
                ) : (
                  <form action={setNextHearingAction} style={{ display: "flex", gap: 8 }}>
                    <input type="hidden" name="caseId" value={id} />
                    <input type="date" name="date" required style={{ flex: 1 }} />
                    <button type="submit" className="act b-add">
                      {t("cases.hearings.scheduleSubmit")}
                    </button>
                  </form>
                )}
              </div>
            )}

            {canEditCase && (
              <div className="panel" id="record-hearing-form">
                <details open={Boolean(upcoming)}>
                  <summary style={{ cursor: "pointer", fontSize: 15, fontWeight: 700 }}>
                    <span className="n">{t("cases.tag.dates")}</span> {t("cases.hearings.record")}
                  </summary>
                  <div className="sub" style={{ marginTop: 8 }}>
                    {t("cases.hearings.recordIntro")}
                  </div>
                <form action={recordHearingAction} style={{ marginTop: 12 }}>
                  <input type="hidden" name="caseId" value={id} />
                  <HearingWizard
                    submitLabel={t("cases.hearings.save")}
                    step1={
                      <>
                        <div className="field">
                          <label>{t("cases.hearings.date")}</label>
                          <input type="date" name="hearingDate" defaultValue={upcoming ? fmt(upcoming.hearingDate) : undefined} required />
                        </div>
                        <div className="field">
                          <label>{t("cases.hearings.rawNotes")}</label>
                          <textarea name="minutes" rows={4} />
                        </div>
                      </>
                    }
                    step2={
                      <div className="two">
                        <div className="field">
                          <label>{t("cases.hearings.kind")}</label>
                          <select name="kind" defaultValue="">
                            <option value="">—</option>
                            {HEARING_KINDS.map((k) => (
                              <option key={k} value={k}>
                                {hearingKindLabel(k)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label>{t("cases.hearings.stage")}</label>
                          <select name="stageIndex" defaultValue="">
                            <option value="">—</option>
                            {PROC_STAGES.map((s, i) => (
                              <option key={s} value={i}>
                                {stageLabel(s)}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field" style={{ gridColumn: "span 2" }}>
                          <label>{t("cases.hearings.result")}</label>
                          <input type="text" name="result" />
                        </div>
                      </div>
                    }
                    step3={
                      <>
                        <div className="field">
                          <label>{t("cases.hearings.nextDate")}</label>
                          <input type="date" name="nextHearingDate" />
                        </div>
                        <div className="two">
                          <div className="field">
                            <label>{t("cases.hearings.addReminder").replace("＋ ", "")}</label>
                            <input type="text" name="actionReminderText" placeholder={t("cases.hearings.addReminder").replace("＋ ", "")} />
                          </div>
                          <div className="field">
                            <label>{t("tasks.dueAt")}</label>
                            <input type="date" name="actionReminderDueOn" />
                          </div>
                          <div className="field">
                            <label>{t("cases.hearings.addTask").replace("＋ ", "")}</label>
                            <input type="text" name="actionTaskTitle" placeholder={t("cases.hearings.addTask").replace("＋ ", "")} />
                          </div>
                          <div className="field">
                            <label>{t("tasks.assignee")}</label>
                            <select name="actionTaskAssigneeId" defaultValue="">
                              <option value="">{t("tasks.unassigned")}</option>
                              {assignableUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label>{t("tasks.dueAt")}</label>
                            <input type="date" name="actionTaskDueAt" />
                          </div>
                        </div>
                        <div className="field" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, background: "#fff" }}>
                          <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                            {t("cases.hearings.requestHint")}
                          </div>
                          <div className="two">
                            <select name="actionRequestParty" defaultValue="OURS">
                              {DOC_PARTIES.filter((p) => p !== "COURT").map((p) => (
                                <option key={p} value={p}>
                                  {docPartyLabel(p)}
                                </option>
                              ))}
                            </select>
                            <select name="actionRequestType" defaultValue="">
                              <option value="">{t("cases.procRequests.typeLabel")}</option>
                              {PROC_REQUEST_TYPES.map((ty) => (
                                <option key={ty} value={ty}>
                                  {ty}
                                </option>
                              ))}
                            </select>
                            <input type="text" name="actionRequestText" placeholder={t("cases.procRequests.typeLabel")} style={{ gridColumn: "span 2" }} />
                          </div>
                        </div>
                        <div className="sub" style={{ marginTop: 8, marginBottom: 0 }}>
                          {t("cases.hearings.actionsAfterSaveHint")}
                        </div>
                      </>
                    }
                    step4={
                      <>
                        <div className="field">
                          <label>{t("cases.hearings.clientReport")}</label>
                          <textarea name="clientReport" rows={3} />
                        </div>
                        <div
                          className="field"
                          style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, background: "#fff" }}
                        >
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                            <input type="checkbox" name="isPending" />
                            {t("cases.hearings.pendingHint")}
                          </label>
                          <div style={{ marginTop: 10 }}>
                            <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                              {t("cases.hearings.pendingItems.title")}
                            </div>
                            <label style={{ display: "inline-flex", alignItems: "center", gap: 5, marginInlineEnd: 14 }}>
                              <input type="checkbox" name="pendingItem_minutes" />
                              {t("cases.hearings.pendingItems.minutes")}
                            </label>
                            <label style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <input type="checkbox" name="pendingItem_nextHearing" />
                              {t("cases.hearings.pendingItems.nextHearing")}
                            </label>
                            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span className="sub">{t("cases.hearings.recurLabel")}</span>
                              <input type="number" name="reminderRecurDays" min={1} defaultValue={7} style={{ width: 70 }} />
                              <span className="sub">{t("cases.hearings.recurUnit")}</span>
                            </div>
                          </div>
                        </div>
                      </>
                    }
                  />
                </form>
                </details>
              </div>
            )}

            <div className="sub" style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>
              {t("cases.hearings")} ({held.length.toLocaleString("ar-SA")})
            </div>
            {held.length === 0 ? (
              <div className="panel">
                <Empty>{t("common.none")}</Empty>
              </div>
            ) : (
              held.map((h) => {
                const acts = hearingActionsById[h.id];
                return (
                  <div className="panel" key={h.id}>
                    <details open>
                      <summary className="hsummary">
                        <span className="chip" style={{ color: "var(--bench)", borderColor: "var(--bench)" }}>
                          {t("cases.hearings.sessionNo", { no: (h.sequenceNo ?? 0).toLocaleString("ar-SA") })}
                        </span>
                        {h.kind && <span className="chip" style={{ color: "var(--gold)", borderColor: "var(--gold)" }}>{hearingKindLabel(h.kind)}</span>}
                        <span className="chip">{fmt(h.hearingDate)}</span>
                        {h.result && <span className="chip" style={{ color: "var(--gold)", borderColor: "var(--gold)" }}>{h.result}</span>}
                        {h.isPending && <span className="chip" style={{ color: "var(--gold)", borderColor: "var(--gold)" }}>{t("cases.hearings.pendingBadge")}</span>}
                      </summary>
                    <div style={{ marginTop: 10 }}>
                    {h.isPending && Array.isArray(h.pendingItems) && h.pendingItems.length > 0 && (
                      <div className="docnote" style={{ marginBottom: 10 }}>
                        ⏳ {t("cases.hearings.pendingItems.awaiting")}:{" "}
                        {(h.pendingItems as string[])
                          .map((k) => t(`cases.hearings.pendingItems.${k}` as MessageKey))
                          .join("، ")}
                        {h.reminderRecurDays ? (
                          <> — {t("cases.hearings.recurLabel")} {h.reminderRecurDays.toLocaleString("ar-SA")} {t("cases.hearings.recurUnit")}</>
                        ) : null}
                      </div>
                    )}
                    {h.minutes && <div style={{ fontSize: 13.5, lineHeight: 1.85, whiteSpace: "pre-wrap", marginBottom: 10 }}>{h.minutes}</div>}
                    {h.clientReport && (
                      <div className="docnote">
                        📄 {t("cases.hearings.clientReport")}: {h.clientReport}
                        {h.reportApproved && h.reportSentToClient ? (
                          <div style={{ marginTop: 6, color: "var(--ok)", fontSize: 12.5, fontWeight: 600 }}>
                            {t("cases.hearings.reportApprovedBadge")}
                          </div>
                        ) : h.reportApprovalRequested ? (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ color: "var(--gold)", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                              {t("cases.hearings.reportPendingApproval")}
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              {canApproveReports && (
                                <>
                                  <form action={approveReportAction}>
                                    <input type="hidden" name="caseId" value={id} />
                                    <input type="hidden" name="hearingId" value={h.id} />
                                    <button type="submit" className="tinybtn" style={{ color: "var(--ok)", borderColor: "var(--ok)" }}>
                                      {t("cases.hearings.approveReport")}
                                    </button>
                                  </form>
                                  <form action={rejectReportAction}>
                                    <input type="hidden" name="caseId" value={id} />
                                    <input type="hidden" name="hearingId" value={h.id} />
                                    <button type="submit" className="tinybtn del">
                                      {t("cases.hearings.rejectReport")}
                                    </button>
                                  </form>
                                </>
                              )}
                              {canEditCase && (
                                <form action={cancelReportApprovalRequestAction}>
                                  <input type="hidden" name="caseId" value={id} />
                                  <input type="hidden" name="hearingId" value={h.id} />
                                  <button type="submit" className="tinybtn">
                                    {t("cases.hearings.cancelApprovalRequest")}
                                  </button>
                                </form>
                              )}
                            </div>
                          </div>
                        ) : (
                          canEditCase && (
                            <div style={{ marginTop: 8 }}>
                              <form action={requestReportApprovalAction}>
                                <input type="hidden" name="caseId" value={id} />
                                <input type="hidden" name="hearingId" value={h.id} />
                                <button type="submit" className="tinybtn">
                                  {t("cases.hearings.requestApproval")}
                                </button>
                              </form>
                            </div>
                          )
                        )}
                        {canEditDocuments && (
                          <form action={generateHearingReportPdfAction} style={{ marginTop: 6 }}>
                            <input type="hidden" name="caseId" value={id} />
                            <input type="hidden" name="hearingId" value={h.id} />
                            <button type="submit" className="tinybtn">
                              {t("cases.hearings.previewReportPdf")}
                            </button>
                          </form>
                        )}
                      </div>
                    )}

                    {(procRequestsByHearing.get(h.id) ?? []).length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(procRequestsByHearing.get(h.id) ?? []).map((r) => (
                          <span className="chip" key={r.id} title={t("cases.hearings.requestLinked")}>
                            {docPartyLabel(r.party as DocParty)} · {r.type ?? r.text}
                          </span>
                        ))}
                      </div>
                    )}

                    {acts && (
                      <div style={{ marginTop: 10 }}>
                        <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                          {t("cases.hearings.actionsTitle")}
                        </div>
                        {acts.reminders.length === 0 && acts.tasks.length === 0 ? (
                          <Empty>{t("cases.hearings.noActions")}</Empty>
                        ) : canEditCase ? (
                          <>
                            {acts.reminders.map((r) => (
                              <form
                                action={updateHearingReminderAction}
                                key={r.id}
                                className="approve-row"
                                style={{ gap: 6, alignItems: "center" }}
                              >
                                <input type="hidden" name="caseId" value={id} />
                                <input type="hidden" name="hearingId" value={h.id} />
                                <input type="hidden" name="reminderId" value={r.id} />
                                <span className="ndot" style={{ background: "#0a7ea4" }} />
                                <span className="chip">{t("cases.hearings.addReminder").replace("＋ ", "")}</span>
                                <input type="text" name="text" defaultValue={r.text} style={{ flex: 1 }} />
                                <input type="date" name="dueOn" defaultValue={fmt(r.dueOn)} />
                                <button type="submit" className="tinybtn">
                                  {t("cases.hearings.actionSave")}
                                </button>
                                {r.isTaskLinked ? (
                                  <span className="chip st done">{t("cases.hearings.escalatedBadge")}</span>
                                ) : (
                                  <>
                                    <select name="assigneeId" defaultValue="">
                                      <option value="">{t("tasks.unassigned")}</option>
                                      {assignableUsers.map((u) => (
                                        <option key={u.id} value={u.id}>
                                          {u.name}
                                        </option>
                                      ))}
                                    </select>
                                    <button type="submit" formAction={escalateHearingReminderAction} className="tinybtn">
                                      {t("cases.hearings.escalate")}
                                    </button>
                                  </>
                                )}
                                <button type="submit" formAction={deleteHearingReminderAction} className="tinybtn del">
                                  {t("cases.hearings.actionDelete")}
                                </button>
                              </form>
                            ))}
                            {acts.tasks.map((tk) => (
                              <form
                                action={updateHearingTaskAction}
                                key={tk.id}
                                className="approve-row"
                                style={{ gap: 6, alignItems: "center" }}
                              >
                                <input type="hidden" name="caseId" value={id} />
                                <input type="hidden" name="hearingId" value={h.id} />
                                <input type="hidden" name="taskId" value={tk.id} />
                                <span className="ndot" style={{ background: "var(--gold)" }} />
                                <span className="chip">{t("cases.hearings.addTask").replace("＋ ", "")}</span>
                                <input type="text" name="title" defaultValue={tk.title} style={{ flex: 1 }} />
                                <select name="assigneeId" defaultValue={tk.assigneeId ?? ""}>
                                  <option value="">{t("tasks.unassigned")}</option>
                                  {assignableUsers.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name}
                                    </option>
                                  ))}
                                </select>
                                <input type="date" name="dueAt" defaultValue={tk.dueAt ? fmt(tk.dueAt) : ""} />
                                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                                  <input type="checkbox" name="done" defaultChecked={tk.status === "DONE"} />
                                  {t("cases.hearings.actionDone")}
                                </label>
                                <button type="submit" className="tinybtn">
                                  {t("cases.hearings.actionSave")}
                                </button>
                                <button type="submit" formAction={deleteHearingTaskAction} className="tinybtn del">
                                  {t("cases.hearings.actionDelete")}
                                </button>
                              </form>
                            ))}
                          </>
                        ) : (
                          <>
                            {acts.reminders.map((r) => (
                              <div className="approve-row" key={r.id}>
                                <span className="ndot" style={{ background: "#0a7ea4" }} />
                                <span className="at">
                                  {r.text}
                                  <span className="chip"> {t("cases.hearings.addReminder").replace("＋ ", "")}</span>
                                </span>
                                <span className="chip">{fmt(r.dueOn)}</span>
                              </div>
                            ))}
                            {acts.tasks.map((tk) => (
                              <div className="approve-row" key={tk.id}>
                                <span className="ndot" style={{ background: "var(--gold)" }} />
                                <span className="at">
                                  {tk.title}
                                  {tk.status === "DONE" && <span className="chip"> ✓ {t("cases.hearings.actionDone")}</span>}
                                  {tk.assignee && <span className="chip"> 👤 {tk.assignee.name}</span>}
                                </span>
                                <span className="chip">{tk.dueAt ? fmt(tk.dueAt) : ""}</span>
                              </div>
                            ))}
                          </>
                        )}
                        {canEditCase && (
                          <div className="two" style={{ marginTop: 10 }}>
                            <form action={addHearingReminderAction} style={{ display: "flex", gap: 6 }}>
                              <input type="hidden" name="caseId" value={id} />
                              <input type="hidden" name="hearingId" value={h.id} />
                              <input type="text" name="text" placeholder={t("cases.hearings.actionText")} required style={{ flex: 1 }} />
                              <input type="date" name="dueOn" required />
                              <button type="submit" className="tinybtn">
                                {t("cases.hearings.addReminder")}
                              </button>
                            </form>
                            <form action={addHearingTaskAction} style={{ display: "flex", gap: 6 }}>
                              <input type="hidden" name="caseId" value={id} />
                              <input type="hidden" name="hearingId" value={h.id} />
                              <input type="text" name="title" placeholder={t("cases.hearings.actionText")} required style={{ flex: 1 }} />
                              <select name="assigneeId" defaultValue="">
                                <option value="">{t("tasks.unassigned")}</option>
                                {assignableUsers.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                              <input type="date" name="dueAt" />
                              <button type="submit" className="tinybtn">
                                {t("cases.hearings.addTask")}
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    )}

                    {canEditCase && (
                      <details style={{ marginTop: 12 }}>
                        <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--bench)", fontWeight: 600 }}>
                          {t("cases.hearings.attachDoc")}
                        </summary>
                        <form
                          action={uploadDocumentAction}
                          encType="multipart/form-data"
                          style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}
                        >
                          <input type="hidden" name="caseId" value={id} />
                          <input type="hidden" name="hearingId" value={h.id} />
                          <div className="sub" style={{ fontWeight: 600 }}>
                            {t("cases.hearings.attachTitle", { no: (h.sequenceNo ?? 0).toLocaleString("ar-SA") })}
                          </div>
                          <div className="field">
                            <label>{t("cases.hearings.attachParty")}</label>
                            <select name="party" defaultValue="">
                              <option value="">—</option>
                              {DOC_PARTIES.map((p) => (
                                <option key={p} value={p}>
                                  {docPartyLabel(p)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label>{t("cases.hearings.attachSessionLabel")}</label>
                            <input
                              type="text"
                              name="sessionLabel"
                              defaultValue={t("cases.hearings.sessionNo", { no: (h.sequenceNo ?? 0).toLocaleString("ar-SA") })}
                            />
                          </div>
                          <div className="field">
                            <input type="file" name="file" required />
                          </div>
                          <div className="actions">
                            <button type="submit" className="act b-add">
                              {t("cases.hearings.attachSubmit")}
                            </button>
                          </div>
                        </form>
                      </details>
                    )}

                    {canEditCase && (
                      <details style={{ marginTop: 12 }}>
                        <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--bench)", fontWeight: 600 }}>
                          {t("cases.hearings.edit")}
                        </summary>
                        <form action={updateHearingAction} style={{ marginTop: 10 }}>
                          <input type="hidden" name="caseId" value={id} />
                          <input type="hidden" name="hearingId" value={h.id} />
                          <div className="two">
                            <div className="field">
                              <label>{t("cases.hearings.date")}</label>
                              <input type="date" name="hearingDate" defaultValue={fmt(h.hearingDate)} />
                            </div>
                            <div className="field">
                              <label>{t("cases.hearings.kind")}</label>
                              <select name="kind" defaultValue={h.kind ?? ""}>
                                <option value="">—</option>
                                {HEARING_KINDS.map((k) => (
                                  <option key={k} value={k}>
                                    {hearingKindLabel(k)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="field">
                            <label>{t("cases.hearings.result")}</label>
                            <input type="text" name="result" defaultValue={h.result ?? ""} />
                          </div>
                          <div className="field">
                            <label>{t("cases.hearings.minutes")}</label>
                            <textarea name="minutes" rows={3} defaultValue={h.minutes ?? ""} />
                          </div>
                          <div className="field">
                            <label>{t("cases.hearings.clientReport")}</label>
                            <textarea name="clientReport" rows={2} defaultValue={h.clientReport ?? ""} />
                          </div>
                          {(() => {
                            const existingPendingItems = Array.isArray(h.pendingItems) ? (h.pendingItems as string[]) : [];
                            return (
                              <div
                                className="field"
                                style={{
                                  border: `1px solid ${h.isPending ? "var(--gold)" : "var(--line)"}`,
                                  borderRadius: 12,
                                  padding: 12,
                                  background: h.isPending ? "rgba(194,151,75,.05)" : "#fff",
                                }}
                              >
                                <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                                  <input type="checkbox" name="isPending" defaultChecked={h.isPending} />
                                  {t("cases.hearings.pendingHint")}
                                </label>
                                <div style={{ marginTop: 10 }}>
                                  <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                                    {t("cases.hearings.pendingItems.title")}
                                  </div>
                                  <label style={{ display: "inline-flex", alignItems: "center", gap: 5, marginInlineEnd: 14 }}>
                                    <input
                                      type="checkbox"
                                      name="pendingItem_minutes"
                                      defaultChecked={existingPendingItems.includes("minutes")}
                                    />
                                    {t("cases.hearings.pendingItems.minutes")}
                                  </label>
                                  <label style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                    <input
                                      type="checkbox"
                                      name="pendingItem_nextHearing"
                                      defaultChecked={existingPendingItems.includes("nextHearing")}
                                    />
                                    {t("cases.hearings.pendingItems.nextHearing")}
                                  </label>
                                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span className="sub">{t("cases.hearings.recurLabel")}</span>
                                    <input
                                      type="number"
                                      name="reminderRecurDays"
                                      min={1}
                                      defaultValue={h.reminderRecurDays ?? 7}
                                      style={{ width: 70, textAlign: "center" }}
                                    />
                                    <span className="sub">{t("cases.hearings.recurUnit")}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          <div className="actions">
                            <button type="submit" className="act b-add">
                              {t("cases.hearings.saveEdit")}
                            </button>
                          </div>
                        </form>
                        <form action={deleteHearingAction} style={{ marginTop: 8 }}>
                          <input type="hidden" name="caseId" value={id} />
                          <input type="hidden" name="hearingId" value={h.id} />
                          <button type="submit" className="tinybtn del">
                            {t("cases.hearings.delete")}
                          </button>
                        </form>
                      </details>
                    )}
                    </div>
                    </details>
                  </div>
                );
              })
            )}

            <Panel n={t("cases.tag.dates")} title={t("cases.reminders")}>
              {(() => {
                const rows: { label: string; date: Date }[] = [];
                if (c.objectionDueAt) rows.push({ label: t("cases.objectionDue"), date: c.objectionDueAt });
                if (c.poaExpiresAt) rows.push({ label: t("cases.poaExpiry"), date: c.poaExpiresAt });
                for (const r of c.reminders) rows.push({ label: r.text, date: r.dueOn });
                if (rows.length === 0) return <Empty>{t("common.none")}</Empty>;
                return rows.map((r, i) => {
                  const dl = daysLeft(r.date);
                  const color = dlColor(dl);
                  return (
                    <div className="approve-row" key={i}>
                      <span className="ndot" style={{ background: color }} />
                      <span className="at">{r.label}</span>
                      <span className="chip" style={{ color, borderColor: color }}>
                        {fmt(r.date)}
                      </span>
                    </div>
                  );
                });
              })()}
            </Panel>
          </>
        );
        break;
      }
      case "parties": {
        const communications = await listClientCommunications(session, id);
        tabBody = (
          <>
            <Panel n={t("cases.tag.parties")} title={t("cases.tab.parties")}>
              <div className="approve-row">
                <span className="ndot" style={{ background: "var(--bench)" }} />
                <span className="at">
                  {t("cases.parties.client")}: {c.client?.name ?? "—"}
                  {c.client?.phone && <span className="chip"> {c.client.phone}</span>}
                </span>
                <span className="chip">{partyRoleLabel(c.clientRole)}</span>
              </div>
              <div className="approve-row">
                <span className="ndot" style={{ background: "var(--advocate)" }} />
                <span className="at">
                  {t("cases.parties.opponent")}: {c.opposingParty ?? "—"}
                </span>
              </div>
              <div className="sub" style={{ marginTop: 16, marginBottom: 8 }}>
                {t("cases.parties.assignees")}
              </div>
              {c.assignees.length === 0 ? (
                <Empty>{t("cases.parties.assigneesEmpty")}</Empty>
              ) : (
                c.assignees.map((a) => (
                  <div className="approve-row" key={a.id}>
                    <span className="ndot" style={{ background: "var(--gold)" }} />
                    <span className="at">{a.user.name}</span>
                  </div>
                ))
              )}
            </Panel>
            <Panel
              n={t("cases.tag.parties")}
              title={`${t("cases.comms.title")} — ${t("cases.comms.count", { n: communications.length.toLocaleString("ar-SA") })}`}
            >
              {communications.length === 0 ? (
                <Empty>{t("cases.comms.empty")}</Empty>
              ) : (
                communications.map((comm) => (
                  <div className="approve-row" key={comm.id}>
                    <span className="ndot" style={{ background: "#0a7ea4" }} />
                    <span className="at">
                      {comm.note}
                      <span className="chip"> {clientCommunicationTypeLabel(comm.type)}</span>
                    </span>
                    <span className="chip">{fmt(comm.createdAt)}</span>
                    {canEditCase && (
                      <form action={deleteClientCommunicationAction}>
                        <input type="hidden" name="caseId" value={id} />
                        <input type="hidden" name="commId" value={comm.id} />
                        <button type="submit" className="tinybtn del">
                          {t("cases.hearings.delete")}
                        </button>
                      </form>
                    )}
                  </div>
                ))
              )}
              {canEditCase && (
                <form
                  action={addClientCommunicationAction}
                  style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}
                >
                  <input type="hidden" name="caseId" value={id} />
                  <select name="type" defaultValue={ClientCommunicationType.CALL}>
                    {Object.values(ClientCommunicationType).map((ty) => (
                      <option key={ty} value={ty}>
                        {clientCommunicationTypeLabel(ty)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    name="note"
                    placeholder={t("cases.comms.notePlaceholder")}
                    required
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <button type="submit" className="tinybtn">
                    {t("cases.comms.add")}
                  </button>
                </form>
              )}
            </Panel>
          </>
        );
        break;
      }
      case "assistant": {
        const canUseAi = await canAction(session, PermModule.AI, "edit");
        let interactions: Awaited<ReturnType<typeof listInteractions>> = [];
        try {
          interactions = await listInteractions(session, { caseId: id });
        } catch {
          // AI module not visible to this role — show the tab as empty/denied below.
        }
        tabBody = (
          <>
            <Panel n={t("cases.tag.parties")} title={t("cases.tab.assistant")}>
              <div className="sub" style={{ marginBottom: 10 }}>
                {t("cases.assistant.hint")}
              </div>
              {canUseAi && (
                <div className="chips" style={{ marginBottom: 12 }}>
                  {AI_SMART_TOOLS.map((tool) => (
                    <form action={askAction} key={tool.key} style={{ display: "inline" }}>
                      <input type="hidden" name="caseId" value={id} />
                      <input type="hidden" name="question" value={tool.question} />
                      <button type="submit" className="chip" style={{ cursor: "pointer" }}>
                        {tool.label}
                      </button>
                    </form>
                  ))}
                </div>
              )}
            </Panel>
            {interactions.length === 0 ? (
              <div className="panel">
                <div className="sub" style={{ marginBottom: 0 }}>
                  {t("ai.emptyChat")}
                </div>
              </div>
            ) : (
              interactions.map((i) => <AiAnswer key={i.id} data={i} />)
            )}
            {canUseAi && (
              <form action={askAction} className="panel" style={{ display: "flex", gap: 8, padding: 16 }}>
                <input type="hidden" name="caseId" value={id} />
                <input type="text" name="question" placeholder={t("ai.ask")} style={{ flex: 1 }} />
                <button type="submit" className="act b-add">
                  {t("ai.send")}
                </button>
              </form>
            )}
          </>
        );
        break;
      }
      case "chat": {
        const messages = await listCaseMessages(session, id);
        const staffNameById = new Map((await listAssignableUsers(session)).map((u) => [u.id, u.name]));
        tabBody = (
          <Panel n={t("cases.tag.parties")} title={t("cases.chat.title")}>
            <div className="sub" style={{ marginBottom: 10 }}>
              {t("cases.chat.hint")}
            </div>
            {messages.length === 0 ? (
              <Empty>{t("cases.chat.empty")}</Empty>
            ) : (
              messages.map((m) => (
                <div className="approve-row" key={m.id}>
                  <span
                    className="ndot"
                    style={{ background: m.senderType === "CLIENT" ? "var(--gold)" : "var(--bench)" }}
                  />
                  <span className="at">
                    {m.body}
                    <span className="chip">
                      {" "}
                      {m.senderType === "CLIENT"
                        ? t("cases.chat.fromClient")
                        : (m.senderUserId && staffNameById.get(m.senderUserId)) || t("cases.chat.fromOffice")}
                    </span>
                  </span>
                  <span className="chip">{relTime(m.createdAt)}</span>
                </div>
              ))
            )}
            {canEditCase && (
              <form action={sendCaseMessageAction} style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <input type="hidden" name="caseId" value={id} />
                <input type="text" name="body" placeholder={t("cases.chat.placeholder")} required style={{ flex: 1 }} />
                <button type="submit" className="act b-add">
                  {t("cases.chat.send")}
                </button>
              </form>
            )}
          </Panel>
        );
        break;
      }
      case "documents": {
        let documents: Awaited<ReturnType<typeof listDocuments>> | null = null;
        try {
          documents = await listDocuments(session, id);
        } catch {
          documents = null;
        }
        tabBody = !documents ? (
          <DeniedPanel />
        ) : (
          <>
            {canEditDocuments && (
              <div className="panel">
                <h2 style={{ marginTop: 0 }}>
                  <span className="n">{t("cases.tag.documents")}</span> {t("documents.upload")}
                </h2>
                <form action={uploadDocumentAction} encType="multipart/form-data">
                  <input type="hidden" name="caseId" value={id} />
                  <div className="three">
                    <div className="field">
                      <label>{t("documents.file")}</label>
                      <input type="file" name="file" required />
                    </div>
                    <div className="field">
                      <label>{t("documents.party")}</label>
                      <select name="party" defaultValue="">
                        <option value="">—</option>
                        {DOC_PARTIES.map((p) => (
                          <option key={p} value={p}>
                            {docPartyLabel(p)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>{t("documents.docType")}</label>
                      <input type="text" name="docType" />
                    </div>
                  </div>
                  <div className="field">
                    <label>{t("documents.source")}</label>
                    <select name="source" defaultValue={DocSource.UPLOAD}>
                      {DOC_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {docSourceLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="actions">
                    <button type="submit" className="act b-add">
                      {t("documents.uploadSubmit")}
                    </button>
                  </div>
                </form>
              </div>
            )}
            <Panel n={t("cases.tag.documents")} title={t("documents.caseDocs")}>
            <div style={{ marginBottom: 12 }}>
              <Link href={`/documents?caseId=${c.id}`} className="mini">
                {t("documents.create")}
              </Link>
            </div>
            {(() => {
              const srcCounts = new Map<DocSource, number>();
              const partyCounts = new Map<DocParty, number>();
              for (const d of documents) {
                srcCounts.set(d.source, (srcCounts.get(d.source) ?? 0) + 1);
                if (d.party) partyCounts.set(d.party, (partyCounts.get(d.party) ?? 0) + 1);
              }
              const activeSrc = docSrcParam && (DOC_SOURCES as string[]).includes(docSrcParam) ? (docSrcParam as DocSource) : null;
              const activeParty = docPartyParam && (DOC_PARTIES as string[]).includes(docPartyParam) ? (docPartyParam as DocParty) : null;
              const filteredDocs = documents.filter(
                (d) => (!activeSrc || d.source === activeSrc) && (!activeParty || d.party === activeParty),
              );
              const qs = (over: Record<string, string | null>) => {
                const params = new URLSearchParams();
                params.set("tab", "documents");
                const src = "docsrc" in over ? over.docsrc : activeSrc;
                const party = "docparty" in over ? over.docparty : activeParty;
                if (src) params.set("docsrc", src);
                if (party) params.set("docparty", party);
                return `/cases/${id}?${params.toString()}`;
              };
              return (
                <>
                  <div className="chips" style={{ marginBottom: 8 }}>
                    <Link href={qs({ docsrc: null })} className={`chip${!activeSrc ? " st done" : ""}`}>
                      {t("events.filterAll")} ({documents.length.toLocaleString("ar-SA")})
                    </Link>
                    {DOC_SOURCES.filter((s) => (srcCounts.get(s) ?? 0) > 0).map((s) => (
                      <Link key={s} href={qs({ docsrc: s })} className={`chip${activeSrc === s ? " st done" : ""}`}>
                        {docSourceLabel(s)} ({(srcCounts.get(s) ?? 0).toLocaleString("ar-SA")})
                      </Link>
                    ))}
                  </div>
                  <div className="chips" style={{ marginBottom: 12 }}>
                    <Link href={qs({ docparty: null })} className={`chip${!activeParty ? " st done" : ""}`}>
                      {t("events.filterAll")}
                    </Link>
                    {DOC_PARTIES.filter((p) => (partyCounts.get(p) ?? 0) > 0).map((p) => (
                      <Link key={p} href={qs({ docparty: p })} className={`chip${activeParty === p ? " st done" : ""}`}>
                        {docPartyLabel(p)} ({(partyCounts.get(p) ?? 0).toLocaleString("ar-SA")})
                      </Link>
                    ))}
                  </div>
                  {filteredDocs.length === 0 ? (
                    <Empty>{t("documents.empty")}</Empty>
                  ) : (
                    filteredDocs.map((d) => (
                      <div className="approve-row" key={d.id}>
                        <span className="ndot" style={{ background: "var(--bench)" }} />
                        <span className="at">
                          📄 {d.fileName}
                          <span className="chip"> {docSourceLabel(d.source)}</span>
                          {d.clientVisible && <span className="chip st"> {t("documents.shared")}</span>}
                        </span>
                        <a href={`/api/documents/${d.id}/download`} className="tinybtn">
                          {t("documents.download")}
                        </a>
                        {canEditDocuments && (
                          <>
                            <form action={shareDocumentAction}>
                              <input type="hidden" name="id" value={d.id} />
                              <input type="hidden" name="caseId" value={c.id} />
                              <button type="submit" className="tinybtn">
                                {d.clientVisible ? t("documents.unshare") : t("documents.share")}
                              </button>
                            </form>
                            <form action={deleteDocumentAction}>
                              <input type="hidden" name="id" value={d.id} />
                              <input type="hidden" name="caseId" value={c.id} />
                              <button type="submit" className="tinybtn del">
                                {t("documents.delete")}
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </>
              );
            })()}
            </Panel>
          </>
        );
        break;
      }
      case "contracts": {
        const contracts = await listContracts(session, id);
        tabBody = (
          <Panel n={t("cases.tag.documents")} title={t("cases.contracts.title")}>
            {contracts.length === 0 ? (
              <Empty>{t("cases.contracts.empty")}</Empty>
            ) : (
              contracts.map((k) => (
                <div className="approve-row" key={k.id}>
                  <span className="at">{k.title}</span>
                  <span className={`chip st${k.isSigned ? "" : " done"}`}>
                    {k.isSigned ? t("cases.contracts.signed") : t("cases.contracts.unsigned")}
                  </span>
                  {canEditCase && (
                    <>
                      <form action={toggleContractSignedAction}>
                        <input type="hidden" name="caseId" value={id} />
                        <input type="hidden" name="contractId" value={k.id} />
                        <button type="submit" className="tinybtn">
                          {t("cases.contracts.toggleSign")}
                        </button>
                      </form>
                      <form action={deleteContractAction}>
                        <input type="hidden" name="caseId" value={id} />
                        <input type="hidden" name="contractId" value={k.id} />
                        <button type="submit" className="tinybtn del">
                          {t("cases.hearings.delete")}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              ))
            )}
            {canEditCase && (
              <form action={addContractAction} style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <input type="hidden" name="caseId" value={id} />
                <input type="text" name="title" placeholder={t("cases.contracts.namePlaceholder")} required style={{ flex: 1 }} />
                <button type="submit" className="tinybtn">
                  {t("cases.contracts.add")}
                </button>
              </form>
            )}
          </Panel>
        );
        break;
      }
      case "finance": {
        if (!canViewFinance) {
          tabBody = <DeniedPanel />;
          break;
        }
        const [fee, invoices, expenses, timeEntries] = await Promise.all([
          getFeeAgreement(session, id),
          listInvoices(session, id),
          listExpenses(session, id),
          listTimeEntries(session, id),
        ]);
        const feeInput = fee
          ? { type: fee.type, feeValueMinor: fee.feeValueMinor, percentageBps: fee.percentageBps, awardedMinor: fee.awardedMinor }
          : null;
        const unbilledTime = timeEntries
          .filter((te) => te.billable && !te.invoiced)
          .map((te) => ({ minutes: te.minutes, hourlyRate: te.hourlyRate }));
        const previewNet = feeInput ? feeNet(feeInput, unbilledTime) : 0;
        const agreedMinor =
          fee?.type === FeeType.HOURLY ? null : feeInput ? feeNet(feeInput, []) : null;
        const collectedMinor = invoices.reduce((sum, inv) => sum + inv.paid, 0);
        const remainingMinor = agreedMinor !== null ? Math.max(0, agreedMinor - collectedMinor) : null;
        const pendingExpenses = expenses.filter((e) => e.billable && !e.billed).length;
        tabBody = (
          <>
            <Panel n={t("cases.tag.finance")} title={t("cases.finance.feeAgreement")}>
              {(agreedMinor !== null || collectedMinor > 0) && (
                <div className="kpis" style={{ marginBottom: 12 }}>
                  <Field label={t("cases.finance.agreed")} value={agreedMinor !== null ? formatSar(agreedMinor) : t("cases.finance.undetermined")} />
                  <Field label={t("cases.finance.collected")} value={formatSar(collectedMinor)} />
                  <Field label={t("cases.finance.remaining")} value={remainingMinor !== null ? formatSar(remainingMinor) : t("cases.finance.undetermined")} />
                </div>
              )}
              {!fee ? (
                <Empty>{t("cases.finance.noFee")}</Empty>
              ) : (
                <div className="approve-row" style={{ flexWrap: "wrap" }}>
                  <span className="ndot" style={{ background: "var(--bench)" }} />
                  <span className="at">{feeTypeLabel(fee.type)}</span>
                  {canEditCase && (
                    <form action={generateFeeInvoiceAction}>
                      <input type="hidden" name="caseId" value={id} />
                      <button type="submit" className="tinybtn">
                        {t("cases.finance.generateInvoice")}
                      </button>
                    </form>
                  )}
                  <div style={{ width: "100%", fontSize: 12.5, color: "var(--ink-soft)" }}>
                    {t("cases.finance.invoicePreview", { amount: formatSar(previewNet) })}
                    {pendingExpenses === 0 && <> · {t("cases.finance.noPendingExpenses")}</>}
                  </div>
                </div>
              )}
              {canEditCase && (
                <details style={{ marginTop: 12 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--bench)", fontWeight: 600 }}>
                    {fee ? t("cases.finance.editFee") : t("cases.finance.addFee")}
                  </summary>
                  <form action={saveFeeAgreementAction} style={{ marginTop: 10 }}>
                    <input type="hidden" name="caseId" value={id} />
                    <div className="two">
                      <div className="field">
                        <label>{t("cases.finance.feeType")}</label>
                        <select name="type" defaultValue={fee?.type ?? FeeType.FLAT}>
                          {Object.values(FeeType).map((ft) => (
                            <option key={ft} value={ft}>
                              {feeTypeLabel(ft)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>{t("cases.finance.feeValue")}</label>
                        <input
                          type="number"
                          name="feeValue"
                          min="0"
                          step="0.01"
                          defaultValue={fee?.feeValueMinor ? halalasToRiyals(fee.feeValueMinor) : ""}
                        />
                      </div>
                      <div className="field">
                        <label>{t("cases.finance.percentage")}</label>
                        <input
                          type="number"
                          name="percentage"
                          min="0"
                          max="100"
                          step="0.01"
                          defaultValue={fee?.percentageBps ? fee.percentageBps / 100 : ""}
                        />
                      </div>
                      <div className="field">
                        <label>{t("cases.finance.awarded")}</label>
                        <input
                          type="number"
                          name="awarded"
                          min="0"
                          step="0.01"
                          defaultValue={fee?.awardedMinor ? halalasToRiyals(fee.awardedMinor) : ""}
                        />
                      </div>
                    </div>
                    <div className="actions">
                      <button type="submit" className="act b-add">
                        {t("cases.finance.saveFee")}
                      </button>
                    </div>
                  </form>
                </details>
              )}
            </Panel>
            <Panel n={t("cases.tag.finance")} title={t("cases.finance.invoices")}>
              {invoices.length === 0 ? (
                <Empty>{t("cases.finance.noInvoices")}</Empty>
              ) : (
                invoices.map((inv) => (
                  <Link href={`/finance/${inv.id}`} className="approve-row" style={{ cursor: "pointer" }} key={inv.id}>
                    <span className="ndot" style={{ background: "var(--bench)" }} />
                    <span className="at">
                      {inv.number}
                      <span className="chip"> {formatSar(inv.remaining)}</span>
                    </span>
                    <span className="chip">{invoiceStatusLabel(inv.status)}</span>
                  </Link>
                ))
              )}
            </Panel>
            <Panel n={t("cases.tag.finance")} title={t("cases.finance.expenses")}>
              {expenses.length === 0 ? (
                <Empty>{t("cases.finance.noExpenses")}</Empty>
              ) : (
                expenses.map((e) => (
                  <div className="approve-row" key={e.id}>
                    <span className="ndot" style={{ background: "var(--gold)" }} />
                    <span className="at">
                      {expenseCategoryLabel(e.category)}
                      {e.vendor ? <span className="chip"> {e.vendor}</span> : null}
                    </span>
                    <span className="chip">{formatSar(e.netAmount)}</span>
                  </div>
                ))
              )}
            </Panel>
            <Panel n={t("cases.tag.finance")} title={t("cases.finance.timeEntries")}>
              {timeEntries.length === 0 ? (
                <Empty>{t("cases.finance.noTimeEntries")}</Empty>
              ) : (
                timeEntries.map((te) => (
                  <div className="approve-row" key={te.id}>
                    <span className="ndot" style={{ background: "var(--ink-soft)" }} />
                    <span className="at">{te.lawyer.name}</span>
                    <span className="chip">{Math.round(te.minutes / 6) / 10} س</span>
                  </div>
                ))
              )}
            </Panel>
          </>
        );
        break;
      }
      case "approvals": {
        const approvals = await listApprovals(session, id);
        tabBody = (
          <>
            <div className="panel">
              <div className="sub" style={{ marginBottom: 12 }}>
                {t("cases.approvals.hint")}
              </div>
              {canEditCase && (
                <form action={createApprovalAction} className="two">
                  <input type="hidden" name="caseId" value={id} />
                  <input type="text" name="title" placeholder={t("cases.approvals.titlePlaceholder")} required />
                  <button type="submit" className="act b-add">
                    {t("cases.approvals.new")}
                  </button>
                </form>
              )}
            </div>
            <Panel n={t("cases.tag.approvals")} title={t("cases.tab.approvals")}>
              {approvals.length === 0 ? (
                <Empty>{t("cases.approvals.empty")}</Empty>
              ) : (
                approvals.map((a) => (
                  <div className="approve-row" key={a.id} style={{ flexWrap: "wrap" }}>
                    <span
                      className="ndot"
                      style={{ background: a.stage === ApprovalStage.APPROVED ? "var(--ok)" : "var(--gold)" }}
                    />
                    <span className="at">
                      {a.title}
                      <span className={`chip st${a.stage === ApprovalStage.APPROVED ? "" : " done"}`}>
                        {" "}
                        {approvalStageLabel(a.stage)}
                      </span>
                    </span>
                    {canEditCase && a.stage !== ApprovalStage.APPROVED && (
                      <>
                        <form action={advanceApprovalAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="caseId" value={id} />
                          <button type="submit" className="tinybtn">
                            {t("cases.approvals.advance")}
                          </button>
                        </form>
                        {a.stage !== ApprovalStage.DRAFT && (
                          <form action={rejectApprovalAction}>
                            <input type="hidden" name="id" value={a.id} />
                            <input type="hidden" name="caseId" value={id} />
                            <button type="submit" className="tinybtn del">
                              {t("cases.approvals.reject")}
                            </button>
                          </form>
                        )}
                      </>
                    )}
                    {canEditCase && (
                      <form action={deleteApprovalAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="caseId" value={id} />
                        <button type="submit" className="tinybtn del">
                          {t("cases.hearings.delete")}
                        </button>
                      </form>
                    )}
                    {a.stage === ApprovalStage.APPROVED && (
                      <div style={{ width: "100%", color: "var(--ok)", fontSize: 12.5, fontWeight: 600 }}>
                        {t("cases.approvals.najizReady")}
                      </div>
                    )}
                    {a.log.length > 0 && (
                      <div style={{ width: "100%", fontSize: 11.5, color: "var(--ink-soft)" }}>
                        {a.log.map((ev) => (
                          <div key={ev.id}>
                            · {ev.description} ({relTime(ev.occurredAt)})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </Panel>
          </>
        );
        break;
      }
      case "execution": {
        const execution = await getExecution(session, id);
        if (!execution) {
          tabBody = (
            <div className="panel">
              <div className="sub">{t("cases.execution.notOpened")}</div>
              {canEditCase && (
                <form action={openExecutionAction}>
                  <input type="hidden" name="caseId" value={id} />
                  <div className="two">
                    <div className="field">
                      <label>{t("cases.execution.court")}</label>
                      <input type="text" name="court" />
                    </div>
                    <div className="field">
                      <label>{t("cases.execution.requestNo")}</label>
                      <input type="text" name="requestNo" />
                    </div>
                  </div>
                  <div className="two">
                    <div className="field">
                      <label>{t("cases.execution.amount")}</label>
                      <input type="number" step="0.01" min="0" name="amount" />
                    </div>
                    <div className="field">
                      <label>{t("cases.execution.debtor")}</label>
                      <input type="text" name="debtor" />
                    </div>
                  </div>
                  <div className="field">
                    <label>{t("cases.execution.basis")}</label>
                    <input type="text" name="basis" />
                  </div>
                  <div className="actions">
                    <button type="submit" className="act b-add">
                      {t("cases.execution.open")}
                    </button>
                  </div>
                </form>
              )}
            </div>
          );
        } else {
          const remaining = (execution.amountMinor ?? 0) - execution.collectedMinor;
          tabBody = (
            <>
              <div className="kpis">
                <Field label={t("cases.execution.amount")} value={execution.amountMinor != null ? formatSar(execution.amountMinor) : "—"} />
                <Field label={t("cases.execution.collected")} value={formatSar(execution.collectedMinor)} />
                <Field label={t("cases.execution.remaining")} value={formatSar(Math.max(0, remaining))} />
                <Field label={t("cases.execution.status")} value={executionFileStatusLabel(execution.status)} />
              </div>
              <Panel n={t("cases.tag.finance")} title={t("cases.tab.execution")}>
                <div className="chips" style={{ marginBottom: 12 }}>
                  {execution.court && <span className="chip">{t("cases.execution.court")}: {execution.court}</span>}
                  {execution.requestNo && <span className="chip">{t("cases.execution.requestNo")}: {execution.requestNo}</span>}
                  {execution.debtor && <span className="chip">{t("cases.execution.debtor")}: {execution.debtor}</span>}
                  {execution.basis && <span className="chip">{t("cases.execution.basis")}: {execution.basis}</span>}
                  <span className="chip">{t("cases.execution.openedAt")}: {fmt(execution.openedAt)}</span>
                </div>
                {canEditCase && (
                  <form action={setExecutionStatusAction} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <input type="hidden" name="caseId" value={id} />
                    <input type="hidden" name="executionId" value={execution.id} />
                    <select name="status" defaultValue={execution.status}>
                      {EXEC_FILE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {executionFileStatusLabel(s)}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="tinybtn">
                      {t("common.save")}
                    </button>
                  </form>
                )}
                {canEditCase && (
                  <form action={recordCollectionAction} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <input type="hidden" name="caseId" value={id} />
                    <input type="hidden" name="executionId" value={execution.id} />
                    <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                      <label>{t("cases.execution.collectionAmount")}</label>
                      <input type="number" step="0.01" min="0" name="amount" required />
                    </div>
                    <button type="submit" className="tinybtn">
                      {t("cases.execution.recordCollection")}
                    </button>
                  </form>
                )}
              </Panel>
              <Panel n={t("cases.tag.finance")} title={t("cases.execution.procedures")}>
                {canEditCase && (
                  <form action={addExecutionProcedureAction} className="two" style={{ marginBottom: 12 }}>
                    <input type="hidden" name="caseId" value={id} />
                    <input type="hidden" name="executionId" value={execution.id} />
                    <input type="text" name="type" placeholder={t("cases.execution.procedureType")} required />
                    <input type="text" name="note" placeholder={t("cases.execution.procedureNote")} />
                    <button type="submit" className="act b-add" style={{ gridColumn: "span 2" }}>
                      {t("cases.execution.addProcedure")}
                    </button>
                  </form>
                )}
                {execution.procedures.length === 0 ? (
                  <Empty>{t("cases.execution.noProcedures")}</Empty>
                ) : (
                  execution.procedures.map((p) => (
                    <div className="approve-row" key={p.id}>
                      <span className="ndot" style={{ background: p.status === "EXECUTED" ? "var(--ok)" : "var(--gold)" }} />
                      <span className="at">
                        {p.type}
                        {p.note ? <span className="chip"> {p.note}</span> : null}
                      </span>
                      <span className="chip">{executionProcStatusLabel(p.status)}</span>
                      {canEditCase && (
                        <form action={cycleExecutionProcedureAction}>
                          <input type="hidden" name="caseId" value={id} />
                          <input type="hidden" name="procedureId" value={p.id} />
                          <button type="submit" className="tinybtn">
                            {t("cases.execution.cycleStatus")}
                          </button>
                        </form>
                      )}
                    </div>
                  ))
                )}
              </Panel>
            </>
          );
        }
        break;
      }
      case "events": {
        const eventUsers = await listAssignableUsers(session);
        const userNameById = new Map(eventUsers.map((u) => [u.id, u.name]));
        const actorLabel = (e: (typeof c.events)[number]) =>
          (e.actorUserId && userNameById.get(e.actorUserId)) || e.actor || t("events.actor.system");
        const CASE_EVENT_TYPES = Object.values(CaseEventType);
        const counts = new Map<CaseEventType, number>();
        for (const e of c.events) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
        const activeFilter = eventFilterParam && (CASE_EVENT_TYPES as string[]).includes(eventFilterParam) ? (eventFilterParam as CaseEventType) : null;
        const filteredEvents = activeFilter ? c.events.filter((e) => e.type === activeFilter) : c.events;
        tabBody = (
          <Panel n={t("cases.tag.events")} title={t("cases.timeline")}>
            <div className="chips" style={{ marginBottom: 12 }}>
              <Link href={`/cases/${id}?tab=events`} className={`chip${!activeFilter ? " st done" : ""}`}>
                {t("events.filterAll")} ({c.events.length.toLocaleString("ar-SA")})
              </Link>
              {CASE_EVENT_TYPES.filter((ty) => (counts.get(ty) ?? 0) > 0).map((ty) => (
                <Link
                  key={ty}
                  href={`/cases/${id}?tab=events&evf=${ty}`}
                  className={`chip${activeFilter === ty ? " st done" : ""}`}
                >
                  {CASE_EVENT_ICON[ty]} {caseEventTypeLabel(ty)} ({(counts.get(ty) ?? 0).toLocaleString("ar-SA")})
                </Link>
              ))}
            </div>
            {filteredEvents.length === 0 ? (
              <Empty>{t("common.none")}</Empty>
            ) : (
              filteredEvents.map((e) => (
                <div className="approve-row" key={e.id}>
                  <span className="ndot" style={{ background: "var(--ink-soft)" }}>
                    {CASE_EVENT_ICON[e.type]}
                  </span>
                  <span className="at">
                    {e.description}
                    <span className="chip"> {caseEventTypeLabel(e.type)} · {actorLabel(e)}</span>
                  </span>
                  <span className="chip">{relTime(e.occurredAt)}</span>
                </div>
              ))
            )}
          </Panel>
        );
        break;
      }
      case "closing": {
        const OUTCOMES = [CaseOutcome.WON, CaseOutcome.PARTIAL, CaseOutcome.SETTLED, CaseOutcome.LOST];
        const checklist = (c.closingChecklist as Record<string, boolean> | null) ?? {};
        const doneCount = CLOSING_CHECKLIST_ITEMS.filter((k) => checklist[k]).length;
        tabBody = (
          <>
            <Panel n={t("cases.tag.closing")} title={t("cases.closing.title")}>
              <div className="sub" style={{ marginBottom: 10 }}>{t("cases.closing.intro")}</div>
              <div className="sub">{t("cases.closing.hint")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {canEditCase ? (
                  <>
                    {OUTCOMES.map((o) => (
                      <form action={setOutcomeAction} key={o}>
                        <input type="hidden" name="caseId" value={id} />
                        <input type="hidden" name="outcome" value={o} />
                        <button
                          type="submit"
                          className="tinybtn"
                          style={
                            c.outcome === o
                              ? { background: "var(--bench)", color: "#fff", borderColor: "var(--bench)" }
                              : undefined
                          }
                        >
                          {outcomeLabel(o)}
                        </button>
                      </form>
                    ))}
                    <form action={setOutcomeAction}>
                      <input type="hidden" name="caseId" value={id} />
                      <input type="hidden" name="outcome" value="" />
                      <button type="submit" className="tinybtn">
                        {t("cases.closing.clear")}
                      </button>
                    </form>
                  </>
                ) : (
                  <span className="chip">{c.outcome ? outcomeLabel(c.outcome) : t("common.none")}</span>
                )}
              </div>
            </Panel>

            <div className="grid2">
              <Panel n={t("cases.tag.closing")} title={t("cases.closing.checklist")}>
                <div className="chip" style={{ marginBottom: 10 }}>
                  {doneCount}/{CLOSING_CHECKLIST_ITEMS.length}
                </div>
                {CLOSING_CHECKLIST_ITEMS.map((key) => (
                  <div className="approve-row" key={key}>
                    <span className="ndot" style={{ background: checklist[key] ? "var(--ok)" : "var(--line)" }} />
                    <span className="at">{t(`cases.closing.checklist.${key}`)}</span>
                    {canEditCase && (
                      <form action={toggleChecklistAction}>
                        <input type="hidden" name="caseId" value={id} />
                        <input type="hidden" name="key" value={key} />
                        <button type="submit" className="tinybtn">
                          {checklist[key] ? "✓" : "○"}
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </Panel>

              <div>
                <Panel n={t("cases.tag.closing")} title={t("cases.closing.csat")}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <form action={setCsatAction} key={n} style={{ display: "contents" }}>
                        <input type="hidden" name="caseId" value={id} />
                        <input type="hidden" name="score" value={n} />
                        <button
                          type="submit"
                          disabled={!canEditCase}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: canEditCase ? "pointer" : "default",
                            fontSize: 26,
                            lineHeight: 1,
                            color:
                              c.clientSatisfactionScore && n <= c.clientSatisfactionScore
                                ? "var(--gold)"
                                : "var(--line)",
                          }}
                        >
                          ★
                        </button>
                      </form>
                    ))}
                  </div>
                  <div className="sub" style={{ marginBottom: 0 }}>
                    {c.clientSatisfactionScore
                      ? t("cases.closing.csatDone", { n: c.clientSatisfactionScore })
                      : t("cases.closing.csatPending")}
                  </div>
                </Panel>

                <Panel n={t("cases.tag.closing")} title={t("cases.closing.loyalty")}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
                    {c.referralRequested ? (
                      <span className="chip st">{t("cases.closing.referralSent")}</span>
                    ) : canEditCase ? (
                      <form action={requestReferralAction}>
                        <input type="hidden" name="caseId" value={id} />
                        <button type="submit" className="act b-add">
                          {t("cases.closing.requestReferral")}
                        </button>
                      </form>
                    ) : null}
                    {c.isArchived ? (
                      <span className="chip st done">{t("cases.closing.archived")}</span>
                    ) : canEditCase ? (
                      <form action={archiveCaseAction}>
                        <input type="hidden" name="caseId" value={id} />
                        <button type="submit" className="act b-judge">
                          {t("cases.closing.archive")}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </Panel>
              </div>
            </div>
          </>
        );
        break;
      }
    }

    content = (
      <>
        <Link href="/cases" className="backbtn">
          ‹ {t("cases.title")}
        </Link>
        <div className="vhead">
          <h2>{c.title}</h2>
          <span className="pill">
            {t("cases.number")}: {c.number}
          </span>
          <Link
            href={`/ai/arena/${c.id}`}
            className="mini"
            style={{ marginInlineStart: "auto", color: "var(--warn)", borderColor: "var(--gold)" }}
          >
            ⚖ {t("cases.tab.ai")}
          </Link>
        </div>

        <div
          className="panel"
          style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", alignItems: "center", padding: "12px 16px", marginBottom: 12 }}
        >
          <span className="chip">
            {t("cases.client")}: {c.client?.name ?? "—"}
            {c.clientRole && <> · {partyRoleLabel(c.clientRole)}</>}
          </span>
          <span className="chip">
            {t("cases.opponent")}: {c.opposingParty ?? "—"}
            {opponentRole && <> · {partyRoleLabel(opponentRole)}</>}
          </span>
          <span className="chip st">{caseStatusLabel(c.status)}</span>
          {c.procEnded && (
            <span className="chip st done">{t("cases.proc.ended")}</span>
          )}
          <span className="chip">
            {t("cases.nextHearing")}: {upcoming ? fmt(upcoming.hearingDate) : t("common.none")}
          </span>
          <span className="chip">
            {t("cases.objectionDue")}: {fmt(c.objectionDueAt)}
          </span>
          {upcoming && c.client?.phone && (
            <a
              href={`https://wa.me/${c.client.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                t("cases.header.waRemindText", { date: fmt(upcoming.hearingDate) }),
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mini"
              style={{ color: "var(--wa)", borderColor: "var(--wa)", marginInlineStart: "auto" }}
            >
              {t("cases.header.waRemind")}
            </a>
          )}
          <Link
            href={`/cases/${id}?tab=chat`}
            className="mini"
            style={upcoming && c.client?.phone ? undefined : { marginInlineStart: "auto" }}
          >
            💬 {t("cases.chat.openChat")}
          </Link>
        </div>

        {activeFlags.length > 0 && (
          <div
            className="panel"
            style={{ borderColor: anyHigh ? "var(--advocate)" : "var(--gold)" }}
          >
            <div style={{ color: "var(--advocate)", fontWeight: 600, marginBottom: 8 }}>
              ⚠ {anyHigh ? t("conflict.banner.titleHigh") : t("conflict.banner.title")}
            </div>
            <ul style={{ listStyle: "disc", paddingInlineStart: 20, fontSize: 13.5 }}>
              {messages.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
            <div className="sub" style={{ marginTop: 8, marginBottom: 0 }}>
              {t("conflict.banner.footer")}
            </div>
          </div>
        )}

        <div className="ftabs">
          {TABS.map((tb) => (
            <Link
              key={tb.key}
              href={`/cases/${id}?tab=${tb.key}`}
              className={`ftab${tab === tb.key ? " on" : ""}`}
            >
              {tb.label()}
            </Link>
          ))}
        </div>

        {tabBody}
      </>
    );
  } catch (err) {
    if (err instanceof PermissionError) content = <DeniedPanel />;
    else throw err;
  }

  return <AppShell>{content}</AppShell>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <div className="v" style={{ fontSize: 16 }}>
        {value}
      </div>
      <div className="l">{label}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="sub" style={{ fontSize: 13, marginBottom: 0 }}>
      {children}
    </div>
  );
}

function Panel({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>
        <span className="n">{n}</span> {title}
      </h2>
      {children}
    </div>
  );
}
