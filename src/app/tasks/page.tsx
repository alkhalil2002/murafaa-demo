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
  try {
    const tasks = await listTasks(session);
    content = (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const inCol = tasks.filter((tk) => tk.status === col);
          return (
            <div key={col} className="rounded-2xl border border-line bg-white p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold text-bench">{taskColumnLabel(col)}</span>
                <span className="text-xs text-ink-soft">{inCol.length}</span>
              </div>
              <div className="space-y-2">
                {inCol.map((tk) => (
                  <div key={tk.id} className="rounded-xl border border-parch-line bg-parch p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{tk.title}</span>
                      {tk.priority === "URGENT" && (
                        <span className="shrink-0 rounded-full bg-advocate/15 px-2 py-0.5 text-xs text-advocate">
                          {taskPriorityLabel(tk.priority)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-ink-soft">
                      {tk.assignee?.name ?? t("tasks.unassigned")}
                      {tk.category && <> · {taskCategoryLabel(tk.category)}</>}
                    </div>
                    {tk.case && <div className="mt-1 text-xs text-ink-soft">⚖ {tk.case.title}</div>}
                  </div>
                ))}
                {inCol.length === 0 && <p className="text-xs text-ink-soft">{t("tasks.empty")}</p>}
              </div>
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
      <h1 className="mb-6 font-serif text-3xl text-bench">{t("tasks.title")}</h1>
      {content}
    </AppShell>
  );
}
