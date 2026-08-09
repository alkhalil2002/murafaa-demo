import { redirect } from "next/navigation";
import { TaskCategory, TaskColumn, TaskPriority } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { listTasks } from "@/server/tasks";
import { listAssignableUsers, listCases } from "@/server/cases";
import { canAction, PermissionError } from "@/lib/permissions/guard";
import { PermModule } from "@prisma/client";
import { taskCategoryLabel, taskColumnLabel, taskPriorityLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";
import { createTaskAction, moveTaskAction, deleteTaskAction } from "./actions";

const COLUMNS: TaskColumn[] = [TaskColumn.NEW, TaskColumn.IN_PROGRESS, TaskColumn.DONE];

export default async function TasksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  let total = 0;
  try {
    const [tasks, canEdit] = await Promise.all([listTasks(session), canAction(session, PermModule.TASKS, "edit")]);
    const [assignableUsers, cases] = canEdit ? await Promise.all([listAssignableUsers(session), listCases(session)]) : [[], []];
    total = tasks.length;
    content = (
      <>
        {canEdit && (
          <div className="panel">
            <form action={createTaskAction} className="three" style={{ alignItems: "flex-end" }}>
              <div className="field">
                <label>{t("tasks.newTask")}</label>
                <input type="text" name="title" placeholder={t("tasks.titlePlaceholder")} required />
              </div>
              <div className="field">
                <label>{t("tasks.assignee")}</label>
                <select name="assigneeId" defaultValue="">
                  <option value="">{t("tasks.unassigned")}</option>
                  {assignableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t("tasks.priority")}</label>
                <select name="priority" defaultValue={TaskPriority.NORMAL}>
                  {Object.values(TaskPriority).map((p) => (
                    <option key={p} value={p}>
                      {taskPriorityLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>{t("tasks.category")}</label>
                <select name="category" defaultValue="">
                  <option value="">—</option>
                  {Object.values(TaskCategory).map((c) => (
                    <option key={c} value={c}>
                      {taskCategoryLabel(c)}
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
              <button type="submit" className="act b-add">
                {t("tasks.addSubmit")}
              </button>
            </form>
          </div>
        )}
        <div className="kanban">
          {COLUMNS.map((col) => {
            const inCol = tasks.filter((tk) => tk.status === col);
            const colIdx = COLUMNS.indexOf(col);
            return (
              <div key={col} className="kcol">
                <h4>
                  {taskColumnLabel(col)}
                  <span>{inCol.length.toLocaleString("ar-SA")}</span>
                </h4>
                {inCol.length === 0 ? (
                  <div className="kempty">{t("tasks.empty")}</div>
                ) : (
                  inCol.map((tk) => (
                    <div key={tk.id} className="kcard">
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ flex: 1, fontWeight: 600 }}>{tk.title}</span>
                        {tk.priority === "URGENT" && (
                          <span className="chip" style={{ color: "var(--advocate)", borderColor: "var(--advocate)" }}>
                            {taskPriorityLabel(tk.priority)}
                          </span>
                        )}
                      </div>
                      <div className="chips" style={{ marginTop: 8 }}>
                        <span className="chip">{tk.assignee?.name ?? t("tasks.unassigned")}</span>
                        {tk.category && <span className="chip">{taskCategoryLabel(tk.category)}</span>}
                        {tk.case && <span className="chip">⚖ {tk.case.title}</span>}
                      </div>
                      {canEdit && (
                        <div className="chips" style={{ marginTop: 8 }}>
                          {colIdx > 0 && (
                            <form action={moveTaskAction} style={{ display: "inline" }}>
                              <input type="hidden" name="id" value={tk.id} />
                              <input type="hidden" name="status" value={COLUMNS[colIdx - 1]} />
                              <button type="submit" className="tinybtn">
                                {t("tasks.moveBack")}
                              </button>
                            </form>
                          )}
                          {colIdx < COLUMNS.length - 1 && (
                            <form action={moveTaskAction} style={{ display: "inline" }}>
                              <input type="hidden" name="id" value={tk.id} />
                              <input type="hidden" name="status" value={COLUMNS[colIdx + 1]} />
                              <button type="submit" className="tinybtn">
                                {t("tasks.moveForward")}
                              </button>
                            </form>
                          )}
                          <form action={deleteTaskAction} style={{ display: "inline" }}>
                            <input type="hidden" name="id" value={tk.id} />
                            <button type="submit" className="tinybtn del">
                              {t("tasks.delete")}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
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
        <h2>{t("tasks.title")}</h2>
        <span className="pill">{t("tasks.pill", { n: total.toLocaleString("ar-SA") })}</span>
      </div>
      {content}
    </AppShell>
  );
}
