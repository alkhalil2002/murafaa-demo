"use client";

import { useState } from "react";
import {
  casesArchive,
  casesAssign,
  casesChecklist,
  casesEndProcedure,
  casesOutcome,
  casesPromote,
  casesReferral,
  casesRemand,
  casesReopenProcedure,
  casesSatisfaction,
  casesUnassign,
  casesWaive,
} from "@murafaa/sdk";
import { CASE_OUTCOMES, CLOSING_CHECKLIST_ITEMS } from "@murafaa/rules";
import { t, type MessageKey } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

const c = browserApi;

function ErrorLine({ error }: { error: MessageKey | null }) {
  return error ? <div className="lerr">{t(error)}</div> : null;
}

/** Remand / promote / end procedure, or reopen (legacy procedural-stage tracker). */
export function StageControls({
  id,
  stageIdx,
  last,
  ended,
}: {
  id: string;
  stageIdx: number;
  last: number;
  ended: boolean;
}) {
  const { run, pending, error } = useApiAction();
  const [result, setResult] = useState("");
  if (ended) {
    return (
      <div className="actions">
        <button
          type="button"
          className="tinybtn"
          disabled={pending}
          onClick={() => run(() => casesReopenProcedure({ client: c, path: { id } }))}
        >
          {t("cases.proc.reopen")}
        </button>
        <ErrorLine error={error} />
      </div>
    );
  }
  return (
    <div className="actions">
      {stageIdx > 0 && (
        <button
          type="button"
          className="tinybtn"
          disabled={pending}
          onClick={() => run(() => casesRemand({ client: c, path: { id } }))}
        >
          {t("cases.proc.remand")}
        </button>
      )}
      {stageIdx < last && (
        <button
          type="button"
          className="tinybtn"
          style={{ background: "var(--bench)", color: "#fff" }}
          disabled={pending}
          onClick={() => run(() => casesPromote({ client: c, path: { id } }))}
        >
          {t("cases.proc.promote")}
        </button>
      )}
      <form
        style={{ display: "flex", gap: 6, flex: 1, minWidth: 220 }}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => casesEndProcedure({ client: c, path: { id }, body: { result } }));
        }}
      >
        <input
          type="text"
          value={result}
          onChange={(e) => setResult(e.target.value)}
          placeholder={t("cases.proc.resultPlaceholder")}
          style={{ flex: 1 }}
        />
        <button type="submit" className="tinybtn del" disabled={pending}>
          {t("cases.proc.end")}
        </button>
      </form>
      <ErrorLine error={error} />
    </div>
  );
}

/** Assignee chips (click to remove) and an add picker. */
export function AssigneeManager({
  id,
  assignees,
  available,
}: {
  id: string;
  assignees: Array<{ userId: string; name: string }>;
  available: Array<{ id: string; name: string }>;
}) {
  const { run, pending, error } = useApiAction();
  const [userId, setUserId] = useState("");
  return (
    <div className="field" style={{ marginTop: 14 }}>
      <label>{t("cases.edit.assignees")}</label>
      <div className="chips">
        {assignees.length === 0 ? (
          <span className="sub">{t("common.none")}</span>
        ) : (
          assignees.map((a) => (
            <button
              key={a.userId}
              type="button"
              className="chip"
              style={{ cursor: "pointer" }}
              disabled={pending}
              onClick={() =>
                run(() => casesUnassign({ client: c, path: { id, userId: a.userId } }))
              }
            >
              {a.name} ×
            </button>
          ))
        )}
      </div>
      {available.length > 0 && (
        <form
          style={{ display: "flex", gap: 6, marginTop: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (userId)
              run(
                () => casesAssign({ client: c, path: { id }, body: { userId } }),
                () => setUserId(""),
              );
          }}
        >
          <select value={userId} onChange={(e) => setUserId(e.target.value)} style={{ flex: 1 }}>
            <option value="" disabled>
              {t("cases.edit.addAssignee")}
            </option>
            {available.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button type="submit" className="tinybtn" disabled={pending}>
            {t("cases.edit.addAssignee")}
          </button>
        </form>
      )}
      <ErrorLine error={error} />
    </div>
  );
}

/** Outcome buttons + clear (feeds the win-rate KPI). */
export function OutcomeButtons({
  id,
  current,
}: {
  id: string;
  current: (typeof CASE_OUTCOMES)[number] | null;
}) {
  const { run, pending, error } = useApiAction();
  const set = (outcome: (typeof CASE_OUTCOMES)[number] | null) =>
    run(() => casesOutcome({ client: c, path: { id }, body: { outcome } }));
  return (
    <>
      {CASE_OUTCOMES.map((o) => (
        <button
          key={o}
          type="button"
          className="tinybtn"
          disabled={pending}
          style={
            current === o
              ? { background: "var(--bench)", color: "#fff", borderColor: "var(--bench)" }
              : undefined
          }
          onClick={() => set(o)}
        >
          {t(`case.outcome.${o}` as MessageKey)}
        </button>
      ))}
      <button type="button" className="tinybtn" disabled={pending} onClick={() => set(null)}>
        {t("cases.closing.clear")}
      </button>
      <ErrorLine error={error} />
    </>
  );
}

export function ChecklistItems({
  id,
  checklist,
  canEdit,
}: {
  id: string;
  checklist: Record<string, boolean>;
  canEdit: boolean;
}) {
  const { run, pending } = useApiAction();
  return (
    <>
      {CLOSING_CHECKLIST_ITEMS.map((key) => (
        <div className="approve-row" key={key}>
          <span
            className="ndot"
            style={{ background: checklist[key] ? "var(--ok)" : "var(--line)" }}
          />
          <span className="at">{t(`cases.closing.checklist.${key}` as MessageKey)}</span>
          {canEdit && (
            <button
              type="button"
              className="tinybtn"
              disabled={pending}
              onClick={() => run(() => casesChecklist({ client: c, path: { id }, body: { key } }))}
            >
              {checklist[key] ? "✓" : "○"}
            </button>
          )}
        </div>
      ))}
    </>
  );
}

export function SatisfactionStars({
  id,
  score,
  canEdit,
}: {
  id: string;
  score: number | null;
  canEdit: boolean;
}) {
  const { run, pending } = useApiAction();
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!canEdit || pending}
          onClick={() =>
            run(() => casesSatisfaction({ client: c, path: { id }, body: { score: n } }))
          }
          style={{
            background: "none",
            border: "none",
            cursor: canEdit ? "pointer" : "default",
            fontSize: 32.5,
            lineHeight: 1,
            color: score && n <= score ? "var(--amber-600)" : "var(--line)",
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function ReferralAndArchive({
  id,
  referralRequested,
  isArchived,
  canEdit,
}: {
  id: string;
  referralRequested: boolean;
  isArchived: boolean;
  canEdit: boolean;
}) {
  const { run, pending, error } = useApiAction();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
      {referralRequested ? (
        <span className="chip st">{t("cases.closing.referralSent")}</span>
      ) : canEdit ? (
        <button
          type="button"
          className="act b-add"
          disabled={pending}
          onClick={() => run(() => casesReferral({ client: c, path: { id } }))}
        >
          {t("cases.closing.requestReferral")}
        </button>
      ) : null}
      {isArchived ? (
        <span className="chip st done">{t("cases.closing.archived")}</span>
      ) : canEdit ? (
        <button
          type="button"
          className="act b-judge"
          disabled={pending}
          onClick={() => run(() => casesArchive({ client: c, path: { id } }))}
        >
          {t("cases.closing.archive")}
        </button>
      ) : null}
      <ErrorLine error={error} />
    </div>
  );
}

/** Partner-only documented consent for one conflict flag (docs/06 §4). */
export function WaiveConflictForm({ id, flagId }: { id: string; flagId: string }) {
  const { run, pending, error } = useApiAction();
  const [note, setNote] = useState("");
  return (
    <form
      style={{ display: "inline-flex", gap: 6, marginInlineStart: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => casesWaive({ client: c, path: { id, flagId }, body: { note } }));
      }}
    >
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("conflict.waive.notePlaceholder")}
        required
      />
      <button type="submit" className="tinybtn" disabled={pending}>
        {t("conflict.waive.button")}
      </button>
      <ErrorLine error={error} />
    </form>
  );
}
