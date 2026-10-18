import { ApprovalStage, PermModule, TaskColumn } from "@prisma/client";
import type { AppSession } from "@/lib/auth/types";
import { canAction } from "@/lib/permissions/guard";
import { getDeadlines } from "@/server/deadlines";
import { listTasks } from "@/server/tasks";
import { listPendingApprovals } from "@/server/approvals";
import { listInvoices } from "@/server/invoices";
import { approvalStageLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";

/**
 * Cross-module notification feed (docs/05 "الإشعارات"), composed from the
 * same gated services as /today rather than a stored Notification table —
 * every item is a live read of real state (no fabricated events), and each
 * source query already enforces its own module gate + row scope.
 */

export type NotificationItem = {
  id: string;
  text: string;
  href: string;
  at: Date;
};

export async function getNotifications(session: AppSession): Promise<NotificationItem[]> {
  const [canCases, canAppointments, canFinance, canTasks] = await Promise.all([
    canAction(session, PermModule.CASES, "view"),
    canAction(session, PermModule.APPOINTMENTS, "view"),
    canAction(session, PermModule.FINANCE, "view"),
    canAction(session, PermModule.TASKS, "view"),
  ]);

  const items: NotificationItem[] = [];

  if (canCases) {
    const pending = await listPendingApprovals(session);
    for (const a of pending.filter((p) => p.stage !== ApprovalStage.APPROVED)) {
      items.push({
        id: `approval:${a.id}`,
        text: t("notif.approvalPending", { title: a.title, stage: approvalStageLabel(a.stage) }),
        href: `/cases/${a.case.id}`,
        at: a.createdAt,
      });
    }
  }

  if (canAppointments) {
    const deadlines = await getDeadlines(session);
    for (const d of deadlines.filter((d) => d.kind === "nextHearing" && d.daysLeft >= 0 && d.daysLeft <= 7)) {
      items.push({
        id: `hearing:${d.caseId}:${d.date}`,
        text: t("notif.hearingSoon", { title: d.caseTitle, n: d.daysLeft.toLocaleString("ar-SA") }),
        href: `/cases/${d.caseId}`,
        at: new Date(d.date),
      });
    }
  }

  if (canFinance) {
    const invoices = await listInvoices(session);
    for (const inv of invoices.filter((i) => i.status === "OVERDUE")) {
      items.push({
        id: `invoice:${inv.id}`,
        text: t("notif.invoiceOverdue", { number: inv.number }),
        href: `/finance/${inv.id}`,
        at: new Date(inv.issueDate),
      });
    }
  }

  if (canTasks) {
    const tasks = await listTasks(session);
    for (const tk of tasks.filter((tk) => tk.assigneeId === session.userId && tk.status === TaskColumn.NEW)) {
      items.push({
        id: `task:${tk.id}`,
        text: t("notif.taskAssigned", { title: tk.title }),
        href: `/tasks`,
        at: tk.createdAt,
      });
    }
  }

  return items.sort((a, b) => b.at.getTime() - a.at.getTime());
}
