import { authCurrent, casesAssignable, casesList, tasksList } from "@murafaa/sdk";
import { TASK_COLUMNS } from "@murafaa/rules";
import { t, type MessageKey } from "@murafaa/i18n";
import { DeniedPanel } from "@/components/denied-panel";
import { TaskCardControls, TaskCreateForm } from "@/components/overview/task-board";
import { serverApi } from "@/lib/api";

const arNum = (n: number) => n.toLocaleString("ar-SA");

/** المهام kanban (legacy tasks page). */
export default async function TasksPage() {
  const api = await serverApi();
  const [me, res] = await Promise.all([authCurrent({ client: api }), tasksList({ client: api })]);
  const tasks = res.data?.data;
  const user = me.data?.data;
  const level = user?.modules.TASKS;
  const canEdit = (level === "EDIT" || level === "FULL") && !user?.user.previewRole;
  const canDelete = level === "FULL" && !user?.user.previewRole;
  const caseLevel = user?.modules.CASES;
  const [users, cases] =
    canEdit && caseLevel && caseLevel !== "NONE"
      ? await Promise.all([casesAssignable({ client: api }), casesList({ client: api })])
      : [undefined, undefined];

  return (
    <>
      <div className="vhead">
        <h2>{t("tasks.title")}</h2>
        <span className="pill">{t("tasks.pill", { n: arNum(tasks?.length ?? 0) })}</span>
      </div>
      {!tasks ? (
        <DeniedPanel />
      ) : (
        <>
          {canEdit && (
            <TaskCreateForm
              users={users?.data?.data ?? []}
              cases={(cases?.data?.data ?? []).map((c) => ({ id: c.id, title: c.title }))}
            />
          )}
          <div className="kanban">
            {TASK_COLUMNS.map((col) => {
              const inCol = tasks.filter((tk) => tk.status === col);
              return (
                <div key={col} className="kcol">
                  <h4>
                    {t(`taskColumn.${col}` as MessageKey)}
                    <span>{arNum(inCol.length)}</span>
                  </h4>
                  {inCol.length === 0 ? (
                    <div className="kempty">{t("tasks.empty")}</div>
                  ) : (
                    inCol.map((tk) => (
                      <div key={tk.id} className="kcard">
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <span style={{ flex: 1, fontWeight: 600 }}>{tk.title}</span>
                          {tk.priority === "URGENT" && (
                            <span
                              className="chip"
                              style={{ color: "var(--advocate)", borderColor: "var(--advocate)" }}
                            >
                              {t("taskPriority.URGENT")}
                            </span>
                          )}
                        </div>
                        <div className="chips" style={{ marginTop: 8 }}>
                          <span className="chip">{tk.assigneeName ?? t("tasks.unassigned")}</span>
                          {tk.category && (
                            <span className="chip">
                              {t(`taskCategory.${tk.category}` as MessageKey)}
                            </span>
                          )}
                          {tk.caseTitle && <span className="chip">⚖ {tk.caseTitle}</span>}
                        </div>
                        {canEdit && (
                          <TaskCardControls id={tk.id} column={tk.status} canDelete={canDelete} />
                        )}
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
