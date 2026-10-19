"use client";

import { Fragment, useState } from "react";
import {
  hearingsAddReminder,
  hearingsAddRequest,
  hearingsAddTask,
  hearingsCancelReport,
  hearingsCycleRequest,
  hearingsDecideReport,
  hearingsEscalate,
  hearingsRecord,
  hearingsRemove,
  hearingsRemoveReminder,
  hearingsRemoveRequest,
  hearingsRemoveTask,
  hearingsRequestReport,
  hearingsSetNext,
  hearingsUpdate,
  hearingsUpdateReminder,
  hearingsUpdateTask,
} from "@murafaa/sdk";
import type { RecordHearingBody, UpdateHearingBody } from "@murafaa/sdk";
import {
  DOC_PARTIES,
  HEARING_KINDS,
  HEARING_PENDING_ITEMS,
  PROC_REQUEST_TYPES,
  PROC_STAGES,
} from "@murafaa/rules";
import { t, type MessageKey } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { fmtDate } from "@/lib/dates-ui";
import { HearingDraftButton } from "@/components/ai/ai-controls";
import { useApiAction } from "@/lib/use-api-action";

const c = browserApi;
type User = { id: string; name: string };
type Kind = (typeof HEARING_KINDS)[number];
type Party = (typeof DOC_PARTIES)[number];
type ReqType = (typeof PROC_REQUEST_TYPES)[number];

const stageLabel = (s: string) => t(`case.stage.${s}` as MessageKey);
const kindLabel = (k: string) => t(`hearing.kind.${k}` as MessageKey);
const partyLabel = (p: string) => t(`docParty.${p}` as MessageKey);
/** Labels that legacy derives from the "＋ …" button captions. */
const bare = (k: MessageKey) => t(k).replace("＋ ", "");
const boxStyle = {
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
};

function ErrorLine({ error }: { error: MessageKey | null }) {
  return error ? <div className="lerr">{t(error)}</div> : null;
}

/** FormData text, trimmed; empty → null. */
function str(fd: FormData, name: string): string | null {
  const v = fd.get(name);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
const num = (fd: FormData, name: string) => {
  const v = str(fd, name);
  return v == null ? null : Number(v);
};
const pendingItemsOf = (fd: FormData) =>
  HEARING_PENDING_ITEMS.filter((k) => fd.get(`pendingItem_${k}`) === "on");

function UserOptions({ users }: { users: User[] }) {
  return (
    <>
      <option value="">{t("tasks.unassigned")}</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </>
  );
}

/** Days until the hearing → border colour (legacy dlColor). */
const dlColor = (dl: number) =>
  dl <= 2 ? "var(--advocate)" : dl <= 7 ? "var(--amber-600)" : "var(--ok)";

/** Upcoming-hearing row (record now / edit date / delete), or the schedule form (legacy). */
export function UpcomingHearing({
  caseId,
  upcoming,
  daysLeft,
  canDelete,
}: {
  caseId: string;
  upcoming: { id: string; hearingDate: string } | null;
  daysLeft: number | null;
  canDelete: boolean;
}) {
  const { run, pending, error } = useApiAction();
  const setNext = (fd: FormData) => {
    const date = str(fd, "date");
    if (date) run(() => hearingsSetNext({ client: c, path: { id: caseId }, body: { date } }));
  };

  if (!upcoming) {
    return (
      <>
        <form action={setNext} style={{ display: "flex", gap: 8 }}>
          <input type="date" name="date" required style={{ flex: 1 }} />
          <button type="submit" className="act b-add" disabled={pending}>
            {t("cases.hearings.scheduleSubmit")}
          </button>
        </form>
        <ErrorLine error={error} />
      </>
    );
  }
  const color = dlColor(daysLeft ?? 99);
  return (
    <>
      <div
        className="approve-row"
        style={{
          borderStyle: "dashed",
          borderWidth: 1,
          borderColor: color,
          borderRadius: 12,
          padding: "10px 14px",
        }}
      >
        <span className="ndot" style={{ background: color }} />
        <span className="at">
          {t("cases.hearings.upcomingBadge")}
          <span className="chip"> {fmtDate(upcoming.hearingDate)}</span>
        </span>
        <a
          href="#record-hearing-form"
          className="tinybtn"
          style={{ background: "var(--bench)", color: "#fff" }}
        >
          {t("cases.hearings.recordNow")}
        </a>
        <details style={{ display: "inline-block" }}>
          <summary className="tinybtn" style={{ display: "inline-block", cursor: "pointer" }}>
            {t("cases.hearings.editDate")}
          </summary>
          <form action={setNext} style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input type="date" name="date" defaultValue={fmtDate(upcoming.hearingDate)} required />
            <button
              type="submit"
              className="tinybtn"
              style={{ background: "var(--bench)", color: "#fff" }}
              disabled={pending}
            >
              {t("common.save")}
            </button>
          </form>
        </details>
        {canDelete && (
          <button
            type="button"
            className="tinybtn del"
            disabled={pending}
            onClick={() =>
              run(() => hearingsRemove({ client: c, path: { id: caseId, hearingId: upcoming.id } }))
            }
          >
            {t("cases.hearings.delete")}
          </button>
        )}
      </div>
      <ErrorLine error={error} />
    </>
  );
}

const WZ_STEPS = [
  "cases.hearings.wz.step1",
  "cases.hearings.wz.step2",
  "cases.hearings.wz.step3",
  "cases.hearings.wz.step4",
] as const;

function PendingFields({ isPending, items }: { isPending?: boolean; items?: string[] }) {
  return (
    <div
      className="field"
      style={{
        ...boxStyle,
        ...(isPending
          ? { borderColor: "var(--amber-400)", background: "rgba(194,151,75,.05)" }
          : {}),
      }}
    >
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
        <input type="checkbox" name="isPending" defaultChecked={isPending} />
        {t("cases.hearings.pendingHint")}
      </label>
      <div style={{ marginTop: 10 }}>
        <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
          {t("cases.hearings.pendingItems.title")}
        </div>
        {HEARING_PENDING_ITEMS.map((k, i) => (
          <label
            key={k}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              marginInlineEnd: i === 0 ? 14 : 0,
            }}
          >
            <input type="checkbox" name={`pendingItem_${k}`} defaultChecked={items?.includes(k)} />
            {t(`cases.hearings.pendingItems.${k}` as MessageKey)}
          </label>
        ))}
        <div
          style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
        >
          <span className="sub">{t("cases.hearings.recurLabel")}</span>
          <input
            type="number"
            name="reminderRecurDays"
            min={1}
            max={365}
            defaultValue={7}
            style={{ width: 70 }}
          />
          <span className="sub">{t("cases.hearings.recurUnit")}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The 4-step recording wizard (prototype WZ_STEPS, legacy HearingWizard).
 * Every step stays mounted so the final submit collects the whole form.
 */
export function RecordHearingWizard({
  caseId,
  defaultDate,
  users,
}: {
  caseId: string;
  defaultDate: string | null;
  users: User[];
}) {
  const { run, pending, error } = useApiAction();
  const [step, setStep] = useState(1);
  const [formKey, setFormKey] = useState(0);

  const submit = (fd: FormData) => {
    const isPending = fd.get("isPending") === "on";
    const body: RecordHearingBody = {
      hearingDate: str(fd, "hearingDate") ?? "",
      kind: str(fd, "kind") as Kind | null,
      stageIndex: num(fd, "stageIndex"),
      minutes: str(fd, "minutes"),
      result: str(fd, "result"),
      clientReport: str(fd, "clientReport"),
      nextHearingDate: str(fd, "nextHearingDate"),
      isPending,
      pendingItems: isPending ? pendingItemsOf(fd) : [],
      reminderRecurDays: isPending ? num(fd, "reminderRecurDays") : null,
      actionReminderText: str(fd, "actionReminderText"),
      actionReminderDueOn: str(fd, "actionReminderDueOn"),
      actionTaskTitle: str(fd, "actionTaskTitle"),
      actionTaskAssigneeId: str(fd, "actionTaskAssigneeId"),
      actionTaskDueAt: str(fd, "actionTaskDueAt"),
      actionRequestParty: str(fd, "actionRequestParty") as Party | null,
      actionRequestType: str(fd, "actionRequestType") as ReqType | null,
      // Legacy: a request needs text; the chosen type stands in for an empty note.
      actionRequestText: str(fd, "actionRequestText") ?? str(fd, "actionRequestType"),
    };
    run(
      () => hearingsRecord({ client: c, path: { id: caseId }, body }),
      () => {
        setStep(1);
        setFormKey((k) => k + 1);
      },
    );
  };

  const steps = [
    <Fragment key="s1">
      <div className="field">
        <label>{t("cases.hearings.date")}</label>
        <input type="date" name="hearingDate" defaultValue={defaultDate ?? undefined} required />
      </div>
      <div className="field">
        <label>{t("cases.hearings.rawNotes")}</label>
        <textarea name="minutes" rows={4} />
        <HearingDraftButton caseId={caseId} />
      </div>
    </Fragment>,
    <div key="s2" className="two">
      <div className="field">
        <label>{t("cases.hearings.kind")}</label>
        <select name="kind" defaultValue="">
          <option value="">—</option>
          {HEARING_KINDS.map((k) => (
            <option key={k} value={k}>
              {kindLabel(k)}
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
    </div>,
    <Fragment key="s3">
      <div className="field">
        <label>{t("cases.hearings.nextDate")}</label>
        <input type="date" name="nextHearingDate" />
      </div>
      <div className="two">
        <div className="field">
          <label>{bare("cases.hearings.addReminder")}</label>
          <input
            type="text"
            name="actionReminderText"
            placeholder={bare("cases.hearings.addReminder")}
          />
        </div>
        <div className="field">
          <label>{t("tasks.dueAt")}</label>
          <input type="date" name="actionReminderDueOn" />
        </div>
        <div className="field">
          <label>{bare("cases.hearings.addTask")}</label>
          <input type="text" name="actionTaskTitle" placeholder={bare("cases.hearings.addTask")} />
        </div>
        <div className="field">
          <label>{t("tasks.assignee")}</label>
          <select name="actionTaskAssigneeId" defaultValue="">
            <UserOptions users={users} />
          </select>
        </div>
        <div className="field">
          <label>{t("tasks.dueAt")}</label>
          <input type="date" name="actionTaskDueAt" />
        </div>
      </div>
      <div className="field" style={boxStyle}>
        <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
          {t("cases.hearings.requestHint")}
        </div>
        <div className="two">
          <select name="actionRequestParty" defaultValue="OURS">
            {DOC_PARTIES.filter((p) => p !== "COURT").map((p) => (
              <option key={p} value={p}>
                {partyLabel(p)}
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
          <input
            type="text"
            name="actionRequestText"
            placeholder={t("cases.procRequests.typeLabel")}
            style={{ gridColumn: "span 2" }}
          />
        </div>
      </div>
      <div className="sub" style={{ marginTop: 8, marginBottom: 0 }}>
        {t("cases.hearings.actionsAfterSaveHint")}
      </div>
    </Fragment>,
    <Fragment key="s4">
      <div className="field">
        <label>{t("cases.hearings.clientReport")}</label>
        <textarea name="clientReport" rows={3} />
      </div>
      <PendingFields />
    </Fragment>,
  ];

  return (
    <form key={formKey} action={submit} style={{ marginTop: 12 }}>
      <div className="wzstepper">
        {WZ_STEPS.map((key, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "cur" : "";
          return (
            <div key={key} style={{ display: "contents" }}>
              {i > 0 && <span className="wzsep">›</span>}
              <button type="button" className={`wzstep ${state}`} onClick={() => setStep(n)}>
                {n < step ? "✓" : n.toLocaleString("ar-SA")} · {t(key)}
              </button>
            </div>
          );
        })}
      </div>
      {steps.map((content, i) => (
        <div key={WZ_STEPS[i]} style={{ display: step === i + 1 ? "block" : "none" }}>
          {content}
        </div>
      ))}
      <div className="actions">
        {step > 1 && (
          <button type="button" className="tinybtn" onClick={() => setStep((s) => s - 1)}>
            {t("cases.hearings.wz.back")}
          </button>
        )}
        {step < 4 ? (
          <button type="button" className="act b-add" onClick={() => setStep((s) => s + 1)}>
            {t("cases.hearings.wz.next")}
          </button>
        ) : (
          <button type="submit" className="act b-add" disabled={pending}>
            {t("cases.hearings.save")}
          </button>
        )}
      </div>
      <ErrorLine error={error} />
    </form>
  );
}

type HeldHearing = {
  id: string;
  sequenceNo: number | null;
  hearingDate: string;
  kind: string | null;
  result: string | null;
  minutes: string | null;
  clientReport: string | null;
  reportApprovalRequested: boolean;
  reportApproved: boolean;
  reportSentToClient: boolean;
  isPending: boolean;
  pendingItems: string[];
  reminderRecurDays: number | null;
  actions: {
    reminders: Array<{ id: string; text: string; dueOn: string; isTaskLinked: boolean }>;
    tasks: Array<{
      id: string;
      title: string;
      assigneeId: string | null;
      assigneeName: string | null;
      dueAt: string | null;
      done: boolean;
    }>;
  };
};

/** Client-report approval: request → partner-tier approve/reject; cancel the request (legacy). */
export function ReportApproval({
  caseId,
  h,
  canEdit,
  canApprove,
}: {
  caseId: string;
  h: HeldHearing;
  canEdit: boolean;
  canApprove: boolean;
}) {
  const { run, pending, error } = useApiAction();
  const path = { id: caseId, hearingId: h.id };
  let body: React.ReactNode = null;
  if (h.reportApproved) {
    body = (
      <div style={{ marginTop: 6, color: "var(--ok)", fontSize: 15.625, fontWeight: 600 }}>
        {h.reportSentToClient
          ? t("cases.hearings.reportApprovedBadge")
          : t("cases.hearings.reportApprovedNotSent")}
      </div>
    );
  } else if (h.reportApprovalRequested) {
    body = (
      <div style={{ marginTop: 8 }}>
        <div
          style={{ color: "var(--amber-600)", fontSize: 15.625, fontWeight: 600, marginBottom: 6 }}
        >
          {t("cases.hearings.reportPendingApproval")}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {canApprove && (
            <>
              <button
                type="button"
                className="tinybtn"
                style={{ color: "var(--ok)", borderColor: "var(--ok)" }}
                disabled={pending}
                onClick={() =>
                  run(() => hearingsDecideReport({ client: c, path, body: { approve: true } }))
                }
              >
                {t("cases.hearings.approveReport")}
              </button>
              <button
                type="button"
                className="tinybtn del"
                disabled={pending}
                onClick={() =>
                  run(() => hearingsDecideReport({ client: c, path, body: { approve: false } }))
                }
              >
                {t("cases.hearings.rejectReport")}
              </button>
            </>
          )}
          {canEdit && (
            <button
              type="button"
              className="tinybtn"
              disabled={pending}
              onClick={() => run(() => hearingsCancelReport({ client: c, path }))}
            >
              {t("cases.hearings.cancelApprovalRequest")}
            </button>
          )}
        </div>
      </div>
    );
  } else if (canEdit) {
    body = (
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          className="tinybtn"
          disabled={pending}
          onClick={() => run(() => hearingsRequestReport({ client: c, path }))}
        >
          {t("cases.hearings.requestApproval")}
        </button>
      </div>
    );
  }
  return (
    <>
      {body}
      <ErrorLine error={error} />
    </>
  );
}

/** Follow-up reminders and tasks of a held hearing; editable rows for editors (legacy). */
export function HearingActions({
  caseId,
  h,
  users,
  canEdit,
}: {
  caseId: string;
  h: HeldHearing;
  users: User[];
  canEdit: boolean;
}) {
  const { run, pending, error } = useApiAction();
  const path = { id: caseId, hearingId: h.id };
  const { reminders, tasks } = h.actions;
  const rowStyle = { gap: 6, alignItems: "center", flexWrap: "wrap" } as const;

  let rows: React.ReactNode;
  if (reminders.length === 0 && tasks.length === 0) {
    rows = (
      <div className="sub" style={{ fontSize: 16.25, marginBottom: 0 }}>
        {t("cases.hearings.noActions")}
      </div>
    );
  } else if (canEdit) {
    rows = (
      <>
        {reminders.map((r) => {
          const item = { ...path, itemId: r.id };
          return (
            <form
              key={r.id}
              className="approve-row"
              style={rowStyle}
              action={(fd) => {
                const intent = fd.get("intent");
                if (intent === "delete") {
                  run(() => hearingsRemoveReminder({ client: c, path: item }));
                } else if (intent === "escalate") {
                  run(() =>
                    hearingsEscalate({
                      client: c,
                      path: item,
                      body: { assigneeId: str(fd, "assigneeId") },
                    }),
                  );
                } else {
                  run(() =>
                    hearingsUpdateReminder({
                      client: c,
                      path: item,
                      body: { text: str(fd, "text") ?? "", dueOn: str(fd, "dueOn") ?? "" },
                    }),
                  );
                }
              }}
            >
              <span className="ndot" style={{ background: "#0a7ea4" }} />
              <span className="chip">{bare("cases.hearings.addReminder")}</span>
              <input
                type="text"
                name="text"
                defaultValue={r.text}
                style={{ flex: "1 1 160px", minWidth: 120 }}
              />
              <input type="date" name="dueOn" defaultValue={fmtDate(r.dueOn)} />
              <button
                type="submit"
                name="intent"
                value="save"
                className="tinybtn"
                disabled={pending}
              >
                {t("cases.hearings.actionSave")}
              </button>
              {r.isTaskLinked ? (
                <span className="chip st done">{t("cases.hearings.escalatedBadge")}</span>
              ) : (
                <>
                  <select name="assigneeId" defaultValue="">
                    <UserOptions users={users} />
                  </select>
                  <button
                    type="submit"
                    name="intent"
                    value="escalate"
                    className="tinybtn"
                    disabled={pending}
                  >
                    {t("cases.hearings.escalate")}
                  </button>
                </>
              )}
              <button
                type="submit"
                name="intent"
                value="delete"
                className="tinybtn del"
                disabled={pending}
              >
                {t("cases.hearings.actionDelete")}
              </button>
            </form>
          );
        })}
        {tasks.map((tk) => {
          const item = { ...path, itemId: tk.id };
          return (
            <form
              key={tk.id}
              className="approve-row"
              style={rowStyle}
              action={(fd) => {
                if (fd.get("intent") === "delete") {
                  run(() => hearingsRemoveTask({ client: c, path: item }));
                } else {
                  run(() =>
                    hearingsUpdateTask({
                      client: c,
                      path: item,
                      body: {
                        title: str(fd, "title") ?? "",
                        assigneeId: str(fd, "assigneeId"),
                        dueAt: str(fd, "dueAt"),
                        done: fd.get("done") === "on",
                      },
                    }),
                  );
                }
              }}
            >
              <span className="ndot" style={{ background: "var(--amber-400)" }} />
              <span className="chip">{bare("cases.hearings.addTask")}</span>
              <input
                type="text"
                name="title"
                defaultValue={tk.title}
                style={{ flex: "1 1 160px", minWidth: 120 }}
              />
              <select name="assigneeId" defaultValue={tk.assigneeId ?? ""}>
                <UserOptions users={users} />
              </select>
              <input type="date" name="dueAt" defaultValue={tk.dueAt ? fmtDate(tk.dueAt) : ""} />
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 15 }}>
                <input type="checkbox" name="done" defaultChecked={tk.done} />
                {t("cases.hearings.actionDone")}
              </label>
              <button
                type="submit"
                name="intent"
                value="save"
                className="tinybtn"
                disabled={pending}
              >
                {t("cases.hearings.actionSave")}
              </button>
              <button
                type="submit"
                name="intent"
                value="delete"
                className="tinybtn del"
                disabled={pending}
              >
                {t("cases.hearings.actionDelete")}
              </button>
            </form>
          );
        })}
      </>
    );
  } else {
    rows = (
      <>
        {reminders.map((r) => (
          <div className="approve-row" key={r.id}>
            <span className="ndot" style={{ background: "#0a7ea4" }} />
            <span className="at">
              {r.text}
              <span className="chip"> {bare("cases.hearings.addReminder")}</span>
            </span>
            <span className="chip">{fmtDate(r.dueOn)}</span>
          </div>
        ))}
        {tasks.map((tk) => (
          <div className="approve-row" key={tk.id}>
            <span className="ndot" style={{ background: "var(--amber-400)" }} />
            <span className="at">
              {tk.title}
              {tk.done && <span className="chip"> ✓ {t("cases.hearings.actionDone")}</span>}
              {tk.assigneeName && <span className="chip"> 👤 {tk.assigneeName}</span>}
            </span>
            <span className="chip">{tk.dueAt ? fmtDate(tk.dueAt) : ""}</span>
          </div>
        ))}
      </>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div className="sub" style={{ fontWeight: 600, marginBottom: 6 }}>
        {t("cases.hearings.actionsTitle")}
      </div>
      {rows}
      {canEdit && (
        <div className="two" style={{ marginTop: 10 }}>
          <form
            style={{ display: "flex", gap: 6 }}
            action={(fd) =>
              run(() =>
                hearingsAddReminder({
                  client: c,
                  path,
                  body: { text: str(fd, "text") ?? "", dueOn: str(fd, "dueOn") ?? "" },
                }),
              )
            }
          >
            <input
              type="text"
              name="text"
              placeholder={t("cases.hearings.actionText")}
              required
              style={{ flex: 1 }}
            />
            <input type="date" name="dueOn" required />
            <button type="submit" className="tinybtn" disabled={pending}>
              {t("cases.hearings.addReminder")}
            </button>
          </form>
          <form
            style={{ display: "flex", gap: 6 }}
            action={(fd) =>
              run(() =>
                hearingsAddTask({
                  client: c,
                  path,
                  body: {
                    title: str(fd, "title") ?? "",
                    assigneeId: str(fd, "assigneeId"),
                    dueAt: str(fd, "dueAt"),
                  },
                }),
              )
            }
          >
            <input
              type="text"
              name="title"
              placeholder={t("cases.hearings.actionText")}
              required
              style={{ flex: 1 }}
            />
            <select name="assigneeId" defaultValue="">
              <UserOptions users={users} />
            </select>
            <input type="date" name="dueAt" />
            <button type="submit" className="tinybtn" disabled={pending}>
              {t("cases.hearings.addTask")}
            </button>
          </form>
        </div>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

/** Edit the minutes of a held hearing, or delete it (legacy <details> editor). */
export function HearingEditor({
  caseId,
  h,
  canDelete,
}: {
  caseId: string;
  h: HeldHearing;
  canDelete: boolean;
}) {
  const { run, pending, error } = useApiAction();
  const path = { id: caseId, hearingId: h.id };
  const save = (fd: FormData) => {
    const isPending = fd.get("isPending") === "on";
    const body: UpdateHearingBody = {
      hearingDate: str(fd, "hearingDate") ?? undefined,
      kind: str(fd, "kind") as Kind | null,
      result: str(fd, "result"),
      minutes: str(fd, "minutes"),
      clientReport: str(fd, "clientReport"),
      isPending,
      pendingItems: isPending ? pendingItemsOf(fd) : [],
      reminderRecurDays: isPending ? num(fd, "reminderRecurDays") : null,
    };
    run(() => hearingsUpdate({ client: c, path, body }));
  };
  return (
    <details style={{ marginTop: 12 }}>
      <summary
        style={{ cursor: "pointer", fontSize: 15.625, color: "var(--bench)", fontWeight: 600 }}
      >
        {t("cases.hearings.edit")}
      </summary>
      <form action={save} style={{ marginTop: 10 }}>
        <div className="two">
          <div className="field">
            <label>{t("cases.hearings.date")}</label>
            <input type="date" name="hearingDate" defaultValue={fmtDate(h.hearingDate)} />
          </div>
          <div className="field">
            <label>{t("cases.hearings.kind")}</label>
            <select name="kind" defaultValue={h.kind ?? ""}>
              <option value="">—</option>
              {HEARING_KINDS.map((k) => (
                <option key={k} value={k}>
                  {kindLabel(k)}
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
        <PendingFields isPending={h.isPending} items={h.pendingItems} />
        <div className="actions">
          <button type="submit" className="act b-add" disabled={pending}>
            {t("cases.hearings.saveEdit")}
          </button>
          {canDelete && (
            <button
              type="button"
              className="tinybtn del"
              disabled={pending}
              onClick={() => run(() => hearingsRemove({ client: c, path }))}
            >
              {t("cases.hearings.delete")}
            </button>
          )}
        </div>
      </form>
      <ErrorLine error={error} />
    </details>
  );
}

/** Cycle / delete buttons on a procedural request row (legacy). */
export function RequestControls({
  caseId,
  requestId,
  canDelete,
}: {
  caseId: string;
  requestId: string;
  canDelete: boolean;
}) {
  const { run, pending, error } = useApiAction();
  const path = { id: caseId, requestId };
  return (
    <>
      <button
        type="button"
        className="tinybtn"
        disabled={pending}
        onClick={() => run(() => hearingsCycleRequest({ client: c, path }))}
      >
        {t("cases.procRequests.cycleStatus")}
      </button>
      {canDelete && (
        <button
          type="button"
          className="tinybtn del"
          disabled={pending}
          onClick={() => run(() => hearingsRemoveRequest({ client: c, path }))}
        >
          {t("cases.hearings.delete")}
        </button>
      )}
      <ErrorLine error={error} />
    </>
  );
}

/** New procedural request: stage, party, type and an optional note (legacy). */
export function AddRequestForm({ caseId, stageIdx }: { caseId: string; stageIdx: number }) {
  const { run, pending, error } = useApiAction();
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <form
        key={formKey}
        style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}
        action={(fd) => {
          const type = str(fd, "type") as ReqType | null;
          run(
            () =>
              hearingsAddRequest({
                client: c,
                path: { id: caseId },
                body: {
                  stageIndex: num(fd, "stageIndex") ?? stageIdx,
                  party: (str(fd, "party") ?? "OURS") as Party,
                  type,
                  text: str(fd, "text") ?? type ?? "",
                },
              }),
            () => setFormKey((k) => k + 1),
          );
        }}
      >
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
              {partyLabel(p)}
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
        <button type="submit" className="tinybtn" disabled={pending}>
          {t("cases.procRequests.add")}
        </button>
      </form>
      <ErrorLine error={error} />
    </>
  );
}
