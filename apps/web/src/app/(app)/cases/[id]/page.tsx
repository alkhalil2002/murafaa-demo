import Link from "next/link";
import { notFound } from "next/navigation";
import { authCurrent, casesAssignable, casesDetail, crmClients } from "@murafaa/sdk";
import { opponentRole, PROC_STAGES } from "@murafaa/rules";
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
const BUILT: ReadonlySet<Tab> = new Set(["overview", "parties", "events", "closing"]);

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
          <Field label={t("cases.nextHearing")} value={t("common.none")} />
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
          {t("cases.nextHearing")}: {t("common.none")}
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
