import { redirect } from "next/navigation";
import { TaskColumn } from "@prisma/client";
import { AppShell, DeniedPanel } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";
import { listTasks } from "@/server/tasks";
import { PermissionError } from "@/lib/permissions/guard";
import { taskCategoryLabel, taskColumnLabel, taskPriorityLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";

const COLUMNS: TaskColumn[] = [TaskColumn.NEW, TaskColumn.IN_PROGRESS, TaskColumn.DONE];

export default async function TasksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let content: React.ReactNode;
  let total = 0;
  try {
    const tasks = await listTasks(session);
    total = tasks.length;
    content = (
      <div className="kanban">
        {COLUMNS.map((col) => {
          const inCol = tasks.filter((tk) => tk.status === col);
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
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>
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
