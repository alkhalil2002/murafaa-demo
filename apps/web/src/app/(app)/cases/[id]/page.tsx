import Link from "next/link";
import { notFound } from "next/navigation";
import { authCurrent, casesAssignable, casesDetail, crmClients } from "@murafaa/sdk";
import { daysLeft, opponentRole, PROC_STAGES } from "@murafaa/rules";
import { t, tStored, type MessageKey } from "@murafaa/i18n";
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
const BUILT: ReadonlySet<Tab> = new Set(["overview", "hearings", "parties", "events", "closing"]);

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
  searchParams: Promise<{ tab?: string; evf?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam, evf } = await searchParams;
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
