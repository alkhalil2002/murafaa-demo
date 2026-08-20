"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

/**
 * Repeatable rows for the hearing wizard's step 3 (prototype's repeatable
 * "＋ إجراء"/"＋ طلب" buttons) — lets the lawyer log more than one reminder,
 * task, or procedural request in the same wizard pass instead of just one of
 * each. Every row repeats the same field `name` (e.g. `reminders[].text`);
 * the server action zips them back into positional rows via
 * `formData.getAll(name)` (src/app/cases/hearing-actions.ts), so adding a
 * row here needs no extra wiring beyond rendering the input.
 */

let rowIdSeq = 0;
function nextRowId() {
  rowIdSeq += 1;
  return rowIdSeq;
}

function useRows(initialCount: number) {
  const [ids, setIds] = useState<number[]>(() => Array.from({ length: initialCount }, () => nextRowId()));
  const add = () => setIds((prev) => [...prev, nextRowId()]);
  const remove = (id: number) => setIds((prev) => (prev.length > 1 ? prev.filter((x) => x !== id) : prev));
  return { ids, add, remove };
}

export function ReminderRows() {
  const { ids, add, remove } = useRows(1);
  return (
    <div>
      {ids.map((id, i) => (
        <div className="two" key={id} style={{ marginBottom: 6 }}>
          <div className="field">
            <label>{i === 0 ? t("cases.hearings.addReminder").replace("＋ ", "") : ""}</label>
            <input type="text" name="reminders[].text" placeholder={t("cases.hearings.addReminder").replace("＋ ", "")} />
          </div>
          <div className="field" style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label>{i === 0 ? t("tasks.dueAt") : ""}</label>
              <input type="date" name="reminders[].dueOn" />
            </div>
            {ids.length > 1 && (
              <button type="button" className="tinybtn del" onClick={() => remove(id)}>
                {t("cases.hearings.actionDelete")}
              </button>
            )}
          </div>
        </div>
      ))}
      <button type="button" className="tinybtn" onClick={add}>
        {t("cases.hearings.addReminder")}
      </button>
    </div>
  );
}

export function TaskRows({ assignableUsers }: { assignableUsers: { id: string; name: string }[] }) {
  const { ids, add, remove } = useRows(1);
  return (
    <div>
      {ids.map((id, i) => (
        <div className="two" key={id} style={{ marginBottom: 6 }}>
          <div className="field">
            <label>{i === 0 ? t("cases.hearings.addTask").replace("＋ ", "") : ""}</label>
            <input type="text" name="tasks[].title" placeholder={t("cases.hearings.addTask").replace("＋ ", "")} />
          </div>
          <div className="field">
            <label>{i === 0 ? t("tasks.assignee") : ""}</label>
            <select name="tasks[].assigneeId" defaultValue="">
              <option value="">{t("tasks.unassigned")}</option>
              {assignableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label>{i === 0 ? t("tasks.dueAt") : ""}</label>
              <input type="date" name="tasks[].dueAt" />
            </div>
            {ids.length > 1 && (
              <button type="button" className="tinybtn del" onClick={() => remove(id)}>
                {t("cases.hearings.actionDelete")}
              </button>
            )}
          </div>
        </div>
      ))}
      <button type="button" className="tinybtn" onClick={add}>
        {t("cases.hearings.addTask")}
      </button>
    </div>
  );
}

export function ProcedureRequestRows({
  parties,
  requestTypes,
}: {
  /** Pre-resolved {value,label} pairs — a server-computed label function can't
   * cross the server→client boundary as a prop, so the parent resolves labels. */
  parties: readonly { value: string; label: string }[];
  requestTypes: readonly string[];
}) {
  const { ids, add, remove } = useRows(1);
  return (
    <div>
      {ids.map((id) => (
        <div className="two" key={id} style={{ marginBottom: 6 }}>
          <select name="procedureRequests[].party" defaultValue="OURS">
            {parties.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select name="procedureRequests[].type" defaultValue="">
            <option value="">{t("cases.procRequests.typeLabel")}</option>
            {requestTypes.map((ty) => (
              <option key={ty} value={ty}>
                {ty}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="procedureRequests[].text"
            placeholder={t("cases.procRequests.typeLabel")}
            style={{ gridColumn: "span 2" }}
          />
          <div className="field" style={{ gridColumn: "span 2" }}>
            <label>{t("cases.procRequests.attachRequest")}</label>
            <input type="file" name="procedureRequests[].file" />
          </div>
          {ids.length > 1 && (
            <button type="button" className="tinybtn del" onClick={() => remove(id)} style={{ gridColumn: "span 2" }}>
              {t("cases.hearings.actionDelete")}
            </button>
          )}
        </div>
      ))}
      <button type="button" className="tinybtn" onClick={add}>
        {t("cases.hearings.addRequest")}
      </button>
    </div>
  );
}
