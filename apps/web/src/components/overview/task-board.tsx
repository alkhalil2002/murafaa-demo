"use client";

import { useState } from "react";
import { tasksCreate, tasksMove, tasksRemove } from "@murafaa/sdk";
import { TASK_CATEGORIES, TASK_COLUMNS, TASK_PRIORITIES } from "@murafaa/rules";
import { t, type MessageKey } from "@murafaa/i18n";
import { browserApi } from "@/lib/browser-api";
import { useApiAction } from "@/lib/use-api-action";

type Column = (typeof TASK_COLUMNS)[number];

function ErrorLine({ error }: { error: MessageKey | null }) {
  return error ? <div className="lerr">{t(error)}</div> : null;
}

/** New task form above the board (legacy tasks page). */
export function TaskCreateForm({
  users,
  cases,
}: {
  users: Array<{ id: string; name: string }>;
  cases: Array<{ id: string; title: string }>;
}) {
  const { run, pending, error } = useApiAction();
  const [formKey, setFormKey] = useState(0);
  const val = (fd: FormData, k: string) => {
    const v = fd.get(k);
    return typeof v === "string" && v ? v : null;
  };
  return (
    <div className="panel">
      <form
        key={formKey}
        className="three"
        style={{ alignItems: "flex-end" }}
        action={(fd) =>
          run(
            () =>
              tasksCreate({
                client: browserApi,
                body: {
                  title: val(fd, "title") ?? "",
                  assigneeId: val(fd, "assigneeId"),
                  priority: (val(fd, "priority") ?? "NORMAL") as (typeof TASK_PRIORITIES)[number],
                  category: val(fd, "category") as (typeof TASK_CATEGORIES)[number] | null,
                  caseId: val(fd, "caseId"),
                },
              }),
            () => setFormKey((k) => k + 1),
          )
        }
      >
        <div className="field">
          <label>{t("tasks.newTask")}</label>
          <input type="text" name="title" placeholder={t("tasks.titlePlaceholder")} required />
        </div>
        <div className="field">
          <label>{t("tasks.assignee")}</label>
          <select name="assigneeId" defaultValue="">
            <option value="">{t("tasks.unassigned")}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t("tasks.priority")}</label>
          <select name="priority" defaultValue="NORMAL">
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {t(`taskPriority.${p}` as MessageKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{t("tasks.category")}</label>
          <select name="category" defaultValue="">
            <option value="">—</option>
            {TASK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`taskCategory.${c}` as MessageKey)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>⚖</label>
          <select name="caseId" defaultValue="">
            <option value="">—</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="act b-add" disabled={pending}>
          {t("tasks.addSubmit")}
        </button>
      </form>
      <ErrorLine error={error} />
    </div>
  );
}

/** Back / forward / delete under a kanban card (legacy). */
export function TaskCardControls({
  id,
  column,
  canDelete,
}: {
  id: string;
  column: Column;
  canDelete: boolean;
}) {
  const { run, pending, error } = useApiAction();
  const i = TASK_COLUMNS.indexOf(column);
  const move = (status: Column) =>
    run(() => tasksMove({ client: browserApi, path: { id }, body: { status } }));
  const back = TASK_COLUMNS[i - 1];
  const fwd = TASK_COLUMNS[i + 1];
  return (
    <>
      <div className="chips" style={{ marginTop: 8 }}>
        {back && (
          <button type="button" className="tinybtn" disabled={pending} onClick={() => move(back)}>
            {t("tasks.moveBack")}
          </button>
        )}
        {fwd && (
          <button type="button" className="tinybtn" disabled={pending} onClick={() => move(fwd)}>
            {t("tasks.moveForward")}
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            className="tinybtn del"
            disabled={pending}
            onClick={() => run(() => tasksRemove({ client: browserApi, path: { id } }))}
          >
            {t("tasks.delete")}
          </button>
        )}
      </div>
      <ErrorLine error={error} />
    </>
  );
}
