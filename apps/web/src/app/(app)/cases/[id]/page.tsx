import Link from "next/link";
import { notFound } from "next/navigation";
import {
  authCurrent,
  casesAssignable,
  casesDetail,
  caseworkGetExecution,
  caseworkListApprovals,
  caseworkListClientApprovals,
  caseworkListCommunications,
  caseworkListContracts,
  caseworkListMessages,
  crmClients,
  documentsList,
} from "@murafaa/sdk";
import { DOC_PARTIES, daysLeft, opponentRole, PROC_STAGES } from "@murafaa/rules";
import { DOC_SOURCES } from "@murafaa/documents";
import { formatSar, t, tStored, type MessageKey } from "@murafaa/i18n";
import {
  AssigneeManager,
  ChecklistItems,
  OutcomeButtons,
  ReferralAndArchive,
  SatisfactionStars,
  StageControls,
  WaiveConflictForm,
} from "@/components/cases/case-actions";
import { CaseForm } from "@/components/cases/case-form";
import { DeniedPanel } from "@/components/denied-panel";
import {
  ApprovalControls,
  ApprovalCreateForm,
  ChatForm,
  ClientApprovalForm,
  CollectionForm,
  CommunicationForm,
  ContractControls,
  ContractForm,
  EditExecutionForm,
  ExecutionStatusControls,
  OpenExecutionForm,
  ProcedureControls,
  ProcedureForm,
  RemoveCommunicationButton,
  SendForApprovalButton,
} from "@/components/cases/casework";
import {
  ClearOpeningButton,
  DocumentControls,
  HearingReportPdfButton,
  OpeningUploadForm,
  UploadForm,
} from "@/components/documents/document-controls";
import {
  AddRequestForm,
  HearingActions,
  HearingEditor,
  RecordHearingWizard,
  ReportApproval,
  RequestControls,
  UpcomingHearing,
} from "@/components/cases/hearings";
import { serverApi } from "@/lib/api";
import { fmtDate, relTime } from "@/lib/dates-ui";

const TABS = [
  "overview",
  "hearings",
  "parties",
  "assistant",
  "chat",
  "documents",
  "contracts",
  "finance",
  "approvals",
  "execution",
  "events",
  "closing",
] as const;
type Tab = (typeof TABS)[number];
/** Tabs rebuilt so far; the rest belong to later M2 slices and M3–M5 (docs/MIGRATION.md). */
const BUILT: ReadonlySet<Tab> = new Set([
  "overview",
  "hearings",
  "parties",
  "chat",
  "contracts",
  "approvals",
  "execution",
  "documents",
  "events",
  "closing",
]);

const EVENT_ICON: Record<string, string> = {
  STAGE: "⚖",
  REQUEST: "📨",
  DOC: "📄",
  APPROVAL: "✅",
  OPENING: "📂",
  DEADLINE: "⏰",
  MESSAGE: "💬",
  SYSTEM: "⚙",
};

const stageLabel = (s: string) => t(`case.stage.${s}` as MessageKey);
const roleLabel = (r: "PLAINTIFF" | "DEFENDANT") =>
  t(r === "PLAINTIFF" ? "cases.role.plaintiff" : "cases.role.defendant");

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <div className="v" style={{ fontSize: 20 }}>
        {value}
      </div>
      <div className="l">{label}</div>
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="sub" style={{ fontSize: 16.25, marginBottom: 0 }}>
      {children}
    </div>
  );
}

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    evf?: string;
    docsrc?: string;
    docparty?: string;
    docgroup?: string;
  }>;
}) {
  const { id } = await params;
  const { tab: tabParam, evf, docsrc, docparty, docgroup } = await searchParams;
  const tab: Tab = TABS.find((x) => x === tabParam) ?? "overview";
  const api = await serverApi();
  const [res, meRes] = await Promise.all([
    casesDetail({ client: api, path: { id } }),
    authCurrent({ client: api }),
  ]);
  const c = res.data?.data;
  const me = meRes.data?.data;
  if (!c || !me) notFound();

  const level = me.modules.CASES;
  const canEdit = (level === "EDIT" || level === "FULL") && !me.user.previewRole;
  const canWaive = me.isPartner && !me.user.previewRole;
  // Deleting hearings/requests and approving client reports need the case delete level (legacy).
  const canDelete = level === "FULL" && !me.user.previewRole;
  const upcoming = c.upcomingHearing;
  const nextHearing = upcoming ? fmtDate(upcoming.hearingDate) : t("common.none");
  const activeFlags = c.conflicts.filter((f) => f.status === "ACTIVE");
  const waivedFlags = c.conflicts.filter((f) => f.status === "WAIVED");
  const anyHigh = activeFlags.some((f) => f.severity === "HIGH");
  const stageIdx = PROC_STAGES.indexOf(c.stage);
  const docLevel = me.modules.DOCUMENTS;
  const canEditDocs = (docLevel === "EDIT" || docLevel === "FULL") && !me.user.previewRole;
  const canDeleteDocs = docLevel === "FULL" && !me.user.previewRole;
  // Documents feed the overview (opening package, request attachments), hearings and documents tabs.
  const docs =
    docLevel !== "NONE" && (tab === "overview" || tab === "hearings" || tab === "documents")
      ? ((await documentsList({ client: api, path: { id } })).data?.data ?? null)
      : null;
  const sessionLabel = (no: number | null) =>
    t("cases.hearings.sessionNo", { no: (no ?? 0).toLocaleString("ar-SA") });

  let body: React.ReactNode;
  if (!BUILT.has(tab)) {
    body = (
      <div className="panel" style={{ textAlign: "center" }}>
        <p className="sub" style={{ marginBottom: 0 }}>
          {t("common.underConstruction")}
        </p>
      </div>
    );
  } else if (tab === "overview") {
    const [clients, users] = canEdit
      ? await Promise.all([crmClients({ client: api }), casesAssignable({ client: api })])
      : [undefined, undefined];
    const byStage = new Map<number, typeof c.procedureRequests>();
    for (const r of c.procedureRequests)
      byStage.set(r.stageIndex, [...(byStage.get(r.stageIndex) ?? []), r]);
    const available = (users?.data?.data ?? []).filter(
      (u) => !c.assignees.some((a) => a.userId === u.id),
    );
    body = (
      <>
        <div className="kpis">
          <Field label={t("cases.client")} value={c.client?.name ?? "—"} />
          <Field label={t("cases.opponent")} value={c.opposingParty ?? "—"} />
          <Field label={t("cases.stage")} value={stageLabel(c.effectiveStage)} />
          <Field label={t("cases.status")} value={t(`case.status.${c.status}` as MessageKey)} />
          <Field
            label={t("cases.classification")}
            value={
              [c.najizMainClass, c.najizSubClass, c.najizCaseType].filter(Boolean).join(" · ") ||
              "—"
            }
          />
          <Field label={t("cases.judgmentDate")} value={fmtDate(c.judgmentDate)} />
          <Field label={t("cases.objectionDue")} value={fmtDate(c.objectionDueAt)} />
          <Field label={t("cases.nextHearing")} value={nextHearing} />
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
          {canEdit && (
            <StageControls
              id={c.id}
              stageIdx={stageIdx}
              last={PROC_STAGES.length - 1}
              ended={c.procEnded}
            />
          )}
        </Panel>
        <Panel n={t("cases.tag.dates")} title={t("cases.procRequests.title")}>
          {byStage.size === 0 ? (
            <Empty>{t("common.none")}</Empty>
          ) : (
            [...byStage.entries()].map(([stIdx, reqs]) => (
              <div key={stIdx} style={{ marginBottom: 14 }}>
                <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                  {t("cases.procRequests.stageGroup", {
                    stage: stageLabel(PROC_STAGES[stIdx] ?? "RECONCILIATION"),
                  })}{" "}
                  ({reqs.length.toLocaleString("ar-SA")})
                </div>
                {reqs.map((r) => (
                  <div className="approve-row" key={r.id} style={{ flexWrap: "wrap" }}>
                    <span className="chip">
                      {r.party === "OURS"
                        ? t("cases.procRequests.usParty")
                        : t("cases.procRequests.opponentParty")}
                    </span>
                    <span className="at">
                      {r.type ?? r.text}
                      {r.type && r.text && r.text !== r.type && (
                        <span className="chip"> {r.text}</span>
                      )}
                    </span>
                    <span className="chip st">
                      {t(`procedureRequestStatus.${r.status}` as MessageKey)}
                    </span>
                    {canEdit && (
                      <RequestControls caseId={c.id} requestId={r.id} canDelete={canDelete} />
                    )}
                    {docs && (
                      <div
                        style={{
                          width: "100%",
                          fontSize: 15,
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        {docs.filter((d) => d.procedureRequestId === r.id).length === 0 ? (
                          <span className="sub">{t("cases.procRequests.noAttachments")}</span>
                        ) : (
                          docs
                            .filter((d) => d.procedureRequestId === r.id)
                            .map((d) => (
                              <span className="chip" key={d.id}>
                                📎 {d.fileName} ·{" "}
                                {d.procedureDocRole === "RESULT"
                                  ? t("cases.procRequests.resultDoc")
                                  : t("cases.procRequests.requestDoc")}{" "}
                                <DocumentControls
                                  id={d.id}
                                  shared={d.clientVisible}
                                  canEdit={false}
                                  canDelete={canDeleteDocs}
                                />
                              </span>
                            ))
                        )}
                        {canEditDocs && (
                          <>
                            <UploadForm
                              caseId={c.id}
                              fixed={{
                                source: "PROCEDURAL_REQUEST",
                                procedureRequestId: r.id,
                                procedureDocRole: "REQUEST",
                              }}
                              submitLabel={t("cases.procRequests.attachRequest")}
                              style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
                            />
                            <UploadForm
                              caseId={c.id}
                              fixed={{
                                source: "PROCEDURAL_REQUEST",
                                procedureRequestId: r.id,
                                procedureDocRole: "RESULT",
                              }}
                              submitLabel={t("cases.procRequests.attachResult")}
                              style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
                            />
                          </>
                        )}
                      </div>
                    )}
                    {r.log.length > 0 && (
                      <div style={{ width: "100%", fontSize: 14.375, color: "var(--ink-soft)" }}>
                        {r.log.map((ev) => (
                          <div key={ev.id}>
                            ·{" "}
                            {ev.message
                              ? tStored(ev.message.messageKey, ev.message.params)
                              : ev.text}{" "}
                            ({relTime(ev.occurredAt)})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
          {canEdit && <AddRequestForm caseId={c.id} stageIdx={stageIdx} />}
        </Panel>
        {docs &&
          (() => {
            const opening = docs.filter((d) => d.source === "OPENING");
            return (
              <Panel
                n={t("cases.tag.documents")}
                title={`${t("cases.openingPackage.title")} — ${t("cases.openingPackage.itemCount", { n: opening.length.toLocaleString("ar-SA") })}`}
              >
                <div className="sub" style={{ marginBottom: 10 }}>
                  {t("cases.openingPackage.hint")}
                </div>
                {opening.length === 0 ? (
                  <Empty>{t("documents.empty")}</Empty>
                ) : (
                  opening.map((d) => (
                    <div className="approve-row" key={d.id}>
                      <span className="ndot" style={{ background: "var(--bench)" }} />
                      <span className="at">
                        📄 {d.fileName}
                        <span className="chip">
                          {" "}
                          {t(`docParty.${d.party ?? "OURS"}` as MessageKey)}
                        </span>
                        {d.needsOcr && <span className="chip"> OCR</span>}
                        {d.extractedText && (
                          <span className="chip st">
                            {" "}
                            {t("cases.openingPackage.viewExtractedText")}
                          </span>
                        )}
                      </span>
                      <DocumentControls
                        id={d.id}
                        shared={d.clientVisible}
                        canEdit={canEditDocs}
                        canDelete={canDeleteDocs}
                      />
                    </div>
                  ))
                )}
                {canEditDocs && <OpeningUploadForm caseId={c.id} />}
                {opening.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {canEdit && (
                      <SendForApprovalButton
                        caseId={c.id}
                        title={t("cases.openingPackage.sendForApprovalTitle")}
                        label={t("cases.openingPackage.sendForApproval")}
                      />
                    )}
                    {canDeleteDocs && <ClearOpeningButton caseId={c.id} />}
                  </div>
                )}
              </Panel>
            );
          })()}
        {canEdit && (
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>
              <span className="n">{t("cases.tag.parties")}</span> {t("cases.edit.title")}
            </h2>
            <CaseForm
              mode="edit"
              caseId={c.id}
              clients={clients?.data?.data.map((x) => ({ id: x.id, name: x.name })) ?? null}
              initial={{
                number: c.number,
                title: c.title,
                clientRole: c.clientRole,
                clientId: c.client?.id ?? "",
                opposingParty: c.opposingParty ?? "",
                entity: c.entity ?? "",
                najizMainClass: c.najizMainClass ?? undefined,
                najizSubClass: c.najizSubClass ?? undefined,
                najizCaseType: c.najizCaseType ?? undefined,
                city: c.city ?? undefined,
                status: c.status,
              }}
            />
            <AssigneeManager id={c.id} assignees={c.assignees} available={available} />
          </div>
        )}
      </>
    );
  } else if (tab === "hearings") {
    const users = canEdit ? ((await casesAssignable({ client: api })).data?.data ?? []) : [];
    const requestsByHearing = new Map<string, typeof c.procedureRequests>();
    for (const r of c.procedureRequests) {
      if (r.hearingId)
        requestsByHearing.set(r.hearingId, [...(requestsByHearing.get(r.hearingId) ?? []), r]);
    }
    body = (
      <>
        {canEdit && (
          <div className="panel">
            <h2 style={{ marginTop: 0 }}>
              <span className="n">{t("cases.tag.dates")}</span>{" "}
              {upcoming ? t("cases.nextHearing") : t("cases.hearings.schedule")}
            </h2>
            <UpcomingHearing
              caseId={c.id}
              upcoming={upcoming}
              daysLeft={upcoming ? daysLeft(upcoming.hearingDate) : null}
              canDelete={canDelete}
            />
          </div>
        )}
        {canEdit && (
          <div className="panel" id="record-hearing-form">
            <details open={Boolean(upcoming)}>
              <summary style={{ cursor: "pointer", fontSize: 18.75, fontWeight: 700 }}>
                <span className="n">{t("cases.tag.dates")}</span> {t("cases.hearings.record")}
              </summary>
              <div className="sub" style={{ marginTop: 8 }}>
                {t("cases.hearings.recordIntro")}
              </div>
              <RecordHearingWizard
                caseId={c.id}
                defaultDate={upcoming ? fmtDate(upcoming.hearingDate) : null}
                users={users}
              />
            </details>
          </div>
        )}
        <div className="sub" style={{ fontWeight: 600, fontSize: 18.75, marginBottom: 8 }}>
          {t("cases.hearings")} ({c.hearings.length.toLocaleString("ar-SA")})
        </div>
        {c.hearings.length === 0 ? (
          <div className="panel">
            <Empty>{t("common.none")}</Empty>
          </div>
        ) : (
          c.hearings.map((h) => {
            const gold = { color: "var(--gold)", borderColor: "var(--gold)" };
            const linked = requestsByHearing.get(h.id) ?? [];
            return (
              <div className="panel" key={h.id}>
                <details open>
                  <summary className="hsummary">
                    <span
                      className="chip"
                      style={{ color: "var(--bench)", borderColor: "var(--bench)" }}
                    >
                      {t("cases.hearings.sessionNo", {
                        no: (h.sequenceNo ?? 0).toLocaleString("ar-SA"),
                      })}
                    </span>
                    {h.kind && (
                      <span className="chip" style={gold}>
                        {t(`hearing.kind.${h.kind}` as MessageKey)}
                      </span>
                    )}
                    <span className="chip">{fmtDate(h.hearingDate)}</span>
                    {h.result && (
                      <span className="chip" style={gold}>
                        {h.result}
                      </span>
                    )}
                    {h.isPending && (
                      <span className="chip" style={gold}>
                        {t("cases.hearings.pendingBadge")}
                      </span>
                    )}
                  </summary>
                  <div style={{ marginTop: 10 }}>
                    {h.isPending && h.pendingItems.length > 0 && (
                      <div className="docnote" style={{ marginBottom: 10 }}>
                        ⏳ {t("cases.hearings.pendingItems.awaiting")}:{" "}
                        {h.pendingItems
                          .map((k) => t(`cases.hearings.pendingItems.${k}` as MessageKey))
                          .join(t("common.listSep"))}
                        {h.reminderRecurDays ? (
                          <>
                            {" "}
                            — {t("cases.hearings.recurLabel")}{" "}
                            {h.reminderRecurDays.toLocaleString("ar-SA")}{" "}
                            {t("cases.hearings.recurUnit")}
                          </>
                        ) : null}
                      </div>
                    )}
                    {h.minutes && (
                      <div
                        style={{
                          fontSize: 16.875,
                          lineHeight: 1.85,
                          whiteSpace: "pre-wrap",
                          marginBottom: 10,
                        }}
                      >
                        {h.minutes}
                      </div>
                    )}
                    {h.clientReport && (
                      <div className="docnote">
                        📄 {t("cases.hearings.clientReport")}: {h.clientReport}
                        <ReportApproval
                          caseId={c.id}
                          h={h}
                          canEdit={canEdit}
                          canApprove={canDelete}
                        />
                        {canEditDocs && <HearingReportPdfButton caseId={c.id} hearingId={h.id} />}
                      </div>
                    )}
                    {linked.length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {linked.map((r) => (
                          <span
                            className="chip"
                            key={r.id}
                            title={t("cases.hearings.requestLinked")}
                          >
                            {t(`docParty.${r.party}` as MessageKey)} · {r.type ?? r.text}
                          </span>
                        ))}
                      </div>
                    )}
                    <HearingActions caseId={c.id} h={h} users={users} canEdit={canEdit} />
                    {canEditDocs && (
                      <details style={{ marginTop: 12 }}>
                        <summary
                          style={{
                            cursor: "pointer",
                            fontSize: 15.625,
                            color: "var(--bench)",
                            fontWeight: 600,
                          }}
                        >
                          {t("cases.hearings.attachDoc")}
                        </summary>
                        <div className="sub" style={{ fontWeight: 600, marginTop: 10 }}>
                          {t("cases.hearings.attachTitle", {
                            no: (h.sequenceNo ?? 0).toLocaleString("ar-SA"),
                          })}
                        </div>
                        <UploadForm
                          caseId={c.id}
                          fixed={{
                            source: "HEARING",
                            hearingId: h.id,
                            sessionLabel: sessionLabel(h.sequenceNo),
                          }}
                          fields={["party"]}
                          submitLabel={t("cases.hearings.attachSubmit")}
                          style={{ marginTop: 10 }}
                        />
                      </details>
                    )}
                    {canEdit && <HearingEditor caseId={c.id} h={h} canDelete={canDelete} />}
                  </div>
                </details>
              </div>
            );
          })
        )}
      </>
    );
  } else if (tab === "parties") {
    body = (
      <Panel n={t("cases.tag.parties")} title={t("cases.tab.parties")}>
        <div className="approve-row">
          <span className="ndot" style={{ background: "var(--bench)" }} />
          <span className="at">
            {t("cases.parties.client")}: {c.client?.name ?? "—"}
            {c.client?.phone && (
              <span className="chip" dir="ltr">
                {" "}
                {c.client.phone}
              </span>
            )}
          </span>
          <span className="chip">{roleLabel(c.clientRole)}</span>
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
            <div className="approve-row" key={a.userId}>
              <span className="ndot" style={{ background: "var(--gold)" }} />
              <span className="at">{a.name}</span>
            </div>
          ))
        )}
      </Panel>
    );
    const comms =
      (await caseworkListCommunications({ client: api, path: { id } })).data?.data ?? [];
    body = (
      <>
        {body}
        <Panel
          n={t("cases.tag.parties")}
          title={`${t("cases.comms.title")} — ${t("cases.comms.count", { n: comms.length.toLocaleString("ar-SA") })}`}
        >
          {comms.length === 0 ? (
            <Empty>{t("cases.comms.empty")}</Empty>
          ) : (
            comms.map((m) => (
              <div className="approve-row" key={m.id}>
                <span className="ndot" style={{ background: "#0a7ea4" }} />
                <span className="at">
                  {m.note}
                  <span className="chip">
                    {" "}
                    {t(`clientCommunicationType.${m.type}` as MessageKey)}
                  </span>
                </span>
                <span className="chip">{fmtDate(m.createdAt)}</span>
                {canEdit && <RemoveCommunicationButton caseId={c.id} id={m.id} />}
              </div>
            ))
          )}
          {canEdit && <CommunicationForm caseId={c.id} />}
        </Panel>
      </>
    );
  } else if (tab === "chat") {
    const messages = (await caseworkListMessages({ client: api, path: { id } })).data?.data ?? [];
    body = (
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
                    : (m.senderName ?? t("cases.chat.fromOffice"))}
                </span>
              </span>
              <span className="chip">{relTime(m.createdAt)}</span>
            </div>
          ))
        )}
        {canEdit && <ChatForm caseId={c.id} />}
      </Panel>
    );
  } else if (tab === "contracts") {
    const contracts = (await caseworkListContracts({ client: api, path: { id } })).data?.data ?? [];
    body = (
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
              {canEdit && <ContractControls caseId={c.id} id={k.id} />}
            </div>
          ))
        )}
        {canEdit && <ContractForm caseId={c.id} />}
      </Panel>
    );
  } else if (tab === "approvals") {
    const [approvalsRes, clientRes] = await Promise.all([
      caseworkListApprovals({ client: api, path: { id } }),
      caseworkListClientApprovals({ client: api, path: { id } }),
    ]);
    const approvals = approvalsRes.data?.data ?? [];
    const clientApprovals = clientRes.data?.data ?? [];
    const sessionNo = (hearingId: string) =>
      t("cases.hearings.sessionNo", {
        no: (c.hearings.find((h) => h.id === hearingId)?.sequenceNo ?? 0).toLocaleString("ar-SA"),
      });
    const CLIENT_DOT: Record<string, string> = {
      APPROVED: "var(--ok)",
      REJECTED: "var(--advocate)",
      PENDING: "var(--gold)",
    };
    body = (
      <>
        <div className="panel">
          <div className="sub" style={{ marginBottom: 12 }}>
            {t("cases.approvals.hint")}
          </div>
          {canEdit && (
            <ApprovalCreateForm
              caseId={c.id}
              hearings={c.hearings.filter((h) => h.reportApprovalRequested)}
            />
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
                  style={{ background: a.stage === "APPROVED" ? "var(--ok)" : "var(--gold)" }}
                />
                <span className="at">
                  {a.title}
                  <span className={`chip st${a.stage === "APPROVED" ? "" : " done"}`}>
                    {" "}
                    {t(`approvalStage.${a.stage}` as MessageKey)}
                  </span>
                  {a.hearingId && <span className="chip"> {sessionNo(a.hearingId)}</span>}
                </span>
                {canEdit && (
                  <ApprovalControls caseId={c.id} id={a.id} stage={a.stage} canDelete={canDelete} />
                )}
                {a.stage === "APPROVED" && (
                  <div
                    style={{ width: "100%", color: "var(--ok)", fontSize: 15.625, fontWeight: 600 }}
                  >
                    {t("cases.approvals.najizReady")}
                  </div>
                )}
                {a.log.length > 0 && (
                  <div style={{ width: "100%", fontSize: 14.375, color: "var(--ink-soft)" }}>
                    {a.log.map((ev) => (
                      <div key={ev.id}>
                        · {ev.message ? tStored(ev.message.messageKey, ev.message.params) : ev.text}{" "}
                        — {ev.actorName ?? t("events.actor.system")} ({relTime(ev.occurredAt)})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </Panel>
        <Panel n="" title={t("caseWorkspace.clientApprovals.title")}>
          {canEdit && <ClientApprovalForm caseId={c.id} />}
          {clientApprovals.length === 0 ? (
            <Empty>{t("caseWorkspace.clientApprovals.empty")}</Empty>
          ) : (
            clientApprovals.map((a) => (
              <div className="approve-row" key={a.id}>
                <span className="ndot" style={{ background: CLIENT_DOT[a.status] }} />
                <span className="at">
                  {a.title}
                  <span className="chip"> {t(`clientApprovalKind.${a.kind}` as MessageKey)}</span>
                  {a.amount != null && <span className="chip"> {formatSar(a.amount)}</span>}
                </span>
                <span className="chip st">
                  {t(`clientApprovalStatus.${a.status}` as MessageKey)}
                </span>
              </div>
            ))
          )}
        </Panel>
      </>
    );
  } else if (tab === "execution") {
    const [exRes, usersRes] = await Promise.all([
      caseworkGetExecution({ client: api, path: { id } }),
      canEdit ? casesAssignable({ client: api }) : Promise.resolve(undefined),
    ]);
    const ex = exRes.data?.data.execution ?? null;
    const users = usersRes?.data?.data ?? [];
    if (!ex) {
      body = (
        <div className="panel">
          <div className="sub">{t("cases.execution.notOpened")}</div>
          {canEdit && <OpenExecutionForm caseId={c.id} />}
        </div>
      );
    } else {
      const remaining = Math.max(0, (ex.amount ?? 0) - ex.collected);
      body = (
        <>
          <div className="kpis">
            <Field
              label={t("cases.execution.amount")}
              value={ex.amount != null ? formatSar(ex.amount) : "—"}
            />
            <Field label={t("cases.execution.collected")} value={formatSar(ex.collected)} />
            <Field label={t("cases.execution.remaining")} value={formatSar(remaining)} />
            <Field
              label={t("cases.execution.status")}
              value={t(`execFileStatus.${ex.status}` as MessageKey)}
            />
          </div>
          <Panel n={t("cases.tag.finance")} title={t("cases.tab.execution")}>
            <div className="chips" style={{ marginBottom: 12 }}>
              {ex.court && (
                <span className="chip">
                  {t("cases.execution.court")}: {ex.court}
                </span>
              )}
              {ex.requestNo && (
                <span className="chip">
                  {t("cases.execution.requestNo")}: {ex.requestNo}
                </span>
              )}
              {ex.debtor && (
                <span className="chip">
                  {t("cases.execution.debtor")}: {ex.debtor}
                </span>
              )}
              {ex.basis && (
                <span className="chip">
                  {t("cases.execution.basis")}: {ex.basis}
                </span>
              )}
              <span className="chip">
                {t("cases.execution.openedAt")}: {fmtDate(ex.openedAt)}
              </span>
            </div>
            {canEdit && (
              <>
                <EditExecutionForm caseId={c.id} ex={ex} />
                <ExecutionStatusControls caseId={c.id} status={ex.status} />
                <CollectionForm caseId={c.id} />
              </>
            )}
          </Panel>
          <Panel n={t("cases.tag.finance")} title={t("cases.execution.procedures")}>
            {canEdit && <ProcedureForm caseId={c.id} users={users} />}
            {ex.procedures.length === 0 ? (
              <Empty>{t("cases.execution.noProcedures")}</Empty>
            ) : (
              ex.procedures.map((pr) => (
                <div className="approve-row" key={pr.id} style={{ flexWrap: "wrap" }}>
                  <span
                    className="ndot"
                    style={{ background: pr.status === "EXECUTED" ? "var(--ok)" : "var(--gold)" }}
                  />
                  <span className="at">
                    {pr.type}
                    {pr.party && (
                      <span className="chip"> {t(`docParty.${pr.party}` as MessageKey)}</span>
                    )}
                    {pr.date && <span className="chip"> {fmtDate(pr.date)}</span>}
                    {pr.note ? <span className="chip"> {pr.note}</span> : null}
                  </span>
                  <span className="chip">{t(`execProcStatus.${pr.status}` as MessageKey)}</span>
                  {canEdit && <ProcedureControls caseId={c.id} proc={pr} canDelete={canDelete} />}
                </div>
              ))
            )}
          </Panel>
        </>
      );
    }
  } else if (tab === "documents") {
    if (!docs) {
      body = <DeniedPanel />;
    } else {
      const heldLabel = new Map(c.hearings.map((h) => [h.id, sessionLabel(h.sequenceNo)]));
      const activeSrc = DOC_SOURCES.find((x) => x === docsrc) ?? null;
      const activeParty = DOC_PARTIES.find((x) => x === docparty) ?? null;
      const bySession = docgroup === "session";
      const srcCount = (x: string) => docs.filter((d) => d.source === x).length;
      const partyCount = (x: string) => docs.filter((d) => d.party === x).length;
      const shown = docs.filter(
        (d) => (!activeSrc || d.source === activeSrc) && (!activeParty || d.party === activeParty),
      );
      const qs = (over: {
        docsrc?: string | null;
        docparty?: string | null;
        docgroup?: string | null;
      }) => {
        const q = new URLSearchParams({ tab: "documents" });
        const src = "docsrc" in over ? over.docsrc : activeSrc;
        const party = "docparty" in over ? over.docparty : activeParty;
        const grp = "docgroup" in over ? over.docgroup : bySession ? "session" : null;
        if (src) q.set("docsrc", src);
        if (party) q.set("docparty", party);
        if (grp) q.set("docgroup", grp);
        return `/cases/${id}?${q.toString()}`;
      };
      const row = (d: (typeof docs)[number]) => (
        <div className="approve-row" key={d.id} style={{ flexWrap: "wrap" }}>
          <span className="ndot" style={{ background: "var(--bench)" }} />
          <span className="at">
            📄 {d.fileName}
            <span className="chip"> {t(`docSource.${d.source}` as MessageKey)}</span>
            {d.party && <span className="chip"> {t(`docParty.${d.party}` as MessageKey)}</span>}
            {d.clientVisible && <span className="chip st"> {t("documents.shared")}</span>}
          </span>
          <DocumentControls
            id={d.id}
            shared={d.clientVisible}
            canEdit={canEditDocs}
            canDelete={canDeleteDocs}
          />
          {d.extractedText && (
            <details style={{ width: "100%", marginTop: 6 }}>
              <summary style={{ cursor: "pointer", fontSize: 15, color: "var(--bench)" }}>
                {t("documents.extractedText")}
              </summary>
              <div className="sub" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
                {d.extractedText}
              </div>
            </details>
          )}
        </div>
      );
      const groups = () => {
        const keys = [...c.hearings.map((h) => h.id), "none"];
        return keys
          .map((key) => [key, shown.filter((d) => (d.hearingId ?? "none") === key)] as const)
          .filter(([, list]) => list.length > 0)
          .map(([key, list]) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
                {key === "none" ? t("documents.noSession") : heldLabel.get(key)} (
                {list.length.toLocaleString("ar-SA")})
              </div>
              {list.map(row)}
            </div>
          ));
      };
      body = (
        <>
          {canEditDocs && (
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>
                <span className="n">{t("cases.tag.documents")}</span> {t("documents.upload")}
              </h2>
              <UploadForm
                caseId={c.id}
                fields={["party", "docType", "source", "hearing"]}
                hearings={c.hearings.map((h) => ({
                  id: h.id,
                  label: `${sessionLabel(h.sequenceNo)} · ${fmtDate(h.hearingDate)}`,
                }))}
                submitLabel={t("documents.uploadSubmit")}
              />
            </div>
          )}
          <Panel n={t("cases.tag.documents")} title={t("documents.caseDocs")}>
            <div style={{ marginBottom: 12 }}>
              <Link href={`/documents?caseId=${c.id}`} className="mini">
                {t("documents.create")}
              </Link>
            </div>
            <div className="chips" style={{ marginBottom: 8 }}>
              <Link href={qs({ docsrc: null })} className={`chip${!activeSrc ? " st done" : ""}`}>
                {t("events.filterAll")} ({docs.length.toLocaleString("ar-SA")})
              </Link>
              {DOC_SOURCES.filter((x) => srcCount(x) > 0).map((x) => (
                <Link
                  key={x}
                  href={qs({ docsrc: x })}
                  className={`chip${activeSrc === x ? " st done" : ""}`}
                >
                  {t(`docSource.${x}` as MessageKey)} ({srcCount(x).toLocaleString("ar-SA")})
                </Link>
              ))}
            </div>
            <div className="chips" style={{ marginBottom: 8 }}>
              <Link
                href={qs({ docparty: null })}
                className={`chip${!activeParty ? " st done" : ""}`}
              >
                {t("events.filterAll")}
              </Link>
              {DOC_PARTIES.filter((x) => partyCount(x) > 0).map((x) => (
                <Link
                  key={x}
                  href={qs({ docparty: x })}
                  className={`chip${activeParty === x ? " st done" : ""}`}
                >
                  {t(`docParty.${x}` as MessageKey)} ({partyCount(x).toLocaleString("ar-SA")})
                </Link>
              ))}
            </div>
            <div className="chips" style={{ marginBottom: 12 }}>
              <Link href={qs({ docgroup: null })} className={`chip${!bySession ? " st done" : ""}`}>
                {t("documents.flatView")}
              </Link>
              <Link
                href={qs({ docgroup: "session" })}
                className={`chip${bySession ? " st done" : ""}`}
              >
                {t("documents.groupBySession")}
              </Link>
            </div>
            {shown.length === 0 ? (
              <Empty>{t("documents.empty")}</Empty>
            ) : bySession ? (
              groups()
            ) : (
              shown.map(row)
            )}
          </Panel>
        </>
      );
    }
  } else if (tab === "events") {
    const counts = new Map<string, number>();
    for (const e of c.events) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    const filter = evf && counts.has(evf) ? evf : null;
    const shown = filter ? c.events.filter((e) => e.type === filter) : c.events;
    body = (
      <Panel n={t("cases.tag.events")} title={t("cases.timeline")}>
        <div className="chips" style={{ marginBottom: 12 }}>
          <Link href={`/cases/${id}?tab=events`} className={`chip${!filter ? " st done" : ""}`}>
            {t("events.filterAll")} ({c.events.length.toLocaleString("ar-SA")})
          </Link>
          {[...counts.entries()].map(([type, n]) => (
            <Link
              key={type}
              href={`/cases/${id}?tab=events&evf=${type}`}
              className={`chip${filter === type ? " st done" : ""}`}
            >
              {EVENT_ICON[type]} {t(`caseEventType.${type}` as MessageKey)} (
              {n.toLocaleString("ar-SA")})
            </Link>
          ))}
        </div>
        {shown.length === 0 ? (
          <Empty>{t("common.none")}</Empty>
        ) : (
          shown.map((e) => (
            <div className="approve-row" key={e.id}>
              <span className="ndot" style={{ background: "var(--ink-soft)" }}>
                {EVENT_ICON[e.type]}
              </span>
              <span className="at">
                {e.message ? tStored(e.message.messageKey, e.message.params) : e.text}
                <span className="chip">
                  {" "}
                  {t(`caseEventType.${e.type}` as MessageKey)} ·{" "}
                  {e.actorName ?? t("events.actor.system")}
                </span>
              </span>
              <span className="chip">{relTime(e.occurredAt)}</span>
            </div>
          ))
        )}
      </Panel>
    );
  } else {
    const doneCount = Object.values(c.closingChecklist).filter(Boolean).length;
    body = (
      <>
        <Panel n={t("cases.tag.closing")} title={t("cases.closing.title")}>
          <div className="sub" style={{ marginBottom: 10 }}>
            {t("cases.closing.intro")}
          </div>
          <div className="sub">{t("cases.closing.hint")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {canEdit ? (
              <OutcomeButtons id={c.id} current={c.outcome} />
            ) : (
              <span className="chip">
                {c.outcome ? t(`case.outcome.${c.outcome}` as MessageKey) : t("common.none")}
              </span>
            )}
          </div>
        </Panel>
        <div className="grid2">
          <Panel n={t("cases.tag.closing")} title={t("cases.closing.checklist")}>
            <div className="chip" style={{ marginBottom: 10 }}>
              {doneCount}/4
            </div>
            <ChecklistItems id={c.id} checklist={c.closingChecklist} canEdit={canEdit} />
          </Panel>
          <div>
            <Panel n={t("cases.tag.closing")} title={t("cases.closing.csat")}>
              <SatisfactionStars id={c.id} score={c.clientSatisfactionScore} canEdit={canEdit} />
              <div className="sub" style={{ marginBottom: 0 }}>
                {c.clientSatisfactionScore
                  ? t("cases.closing.csatDone", { n: c.clientSatisfactionScore })
                  : t("cases.closing.csatPending")}
              </div>
            </Panel>
            <Panel n={t("cases.tag.closing")} title={t("cases.closing.loyalty")}>
              <ReferralAndArchive
                id={c.id}
                referralRequested={c.referralRequested}
                isArchived={c.isArchived}
                canEdit={canEdit}
              />
            </Panel>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Link href="/cases" className="backbtn">
        ‹ {t("cases.title")}
      </Link>
      <div className="vhead">
        <h2>{c.title}</h2>
        <span className="pill">
          {t("cases.number")}: {c.number}
        </span>
      </div>
      <div
        className="panel"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 14px",
          alignItems: "center",
          padding: "12px 16px",
          marginBottom: 12,
        }}
      >
        <span className="chip">
          {t("cases.client")}: {c.client?.name ?? "—"} · {roleLabel(c.clientRole)}
        </span>
        <span className="chip">
          {t("cases.opponent")}: {c.opposingParty ?? "—"} · {roleLabel(opponentRole(c.clientRole))}
        </span>
        <span className="chip st">{t(`case.status.${c.status}` as MessageKey)}</span>
        {c.procEnded && <span className="chip st done">{t("cases.proc.ended")}</span>}
        <span className="chip">
          {t("cases.nextHearing")}: {nextHearing}
        </span>
        <span className="chip">
          {t("cases.objectionDue")}: {fmtDate(c.objectionDueAt)}
        </span>
      </div>
      {activeFlags.length > 0 && (
        <div className="panel" style={{ borderColor: anyHigh ? "var(--advocate)" : "var(--gold)" }}>
          <div style={{ color: "var(--advocate)", fontWeight: 600, marginBottom: 8 }}>
            ⚠ {anyHigh ? t("conflict.banner.titleHigh") : t("conflict.banner.title")}
          </div>
          <ul style={{ listStyle: "disc", paddingInlineStart: 20, fontSize: 16.875 }}>
            {activeFlags.map((f) => (
              <li key={f.id}>
                {tStored(f.message.messageKey, f.message.params)}
                {canWaive && <WaiveConflictForm id={c.id} flagId={f.id} />}
              </li>
            ))}
          </ul>
          <div className="sub" style={{ marginTop: 8, marginBottom: 0 }}>
            {t("conflict.banner.footer")}
          </div>
        </div>
      )}
      {waivedFlags.length > 0 && (
        <div className="panel">
          {waivedFlags.map((f) => (
            <div key={f.id} className="sub" style={{ marginBottom: 4 }}>
              ✓ {t("conflict.waived")}: {tStored(f.message.messageKey, f.message.params)} —{" "}
              {f.waiverNote}
            </div>
          ))}
        </div>
      )}
      <div className="ftabs">
        {TABS.map((tb) => (
          <Link
            key={tb}
            href={`/cases/${id}?tab=${tb}`}
            className={`ftab${tab === tb ? " on" : ""}`}
          >
            {t(`cases.tab.${tb}` as MessageKey)}
          </Link>
        ))}
      </div>
      {body}
    </>
  );
}
