import { ApprovalStage, CaseOutcome, PermModule, RequestStatus, TaskColumn, TaskPriority } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { canAction } from "@/lib/permissions/guard";
import { getDeadlines } from "@/server/deadlines";
import { listTasks } from "@/server/tasks";
import { listRequests } from "@/server/hr/requests";
import { listPendingApprovals } from "@/server/approvals";
import { getEmployeeOfWeek, type PulseRankRow } from "@/server/pulse";
import { requestKindLabel, requestStatusLabel, roleLabel, approvalStageLabel } from "@/lib/labels";
import { t } from "@/lib/i18n";

/**
 * "اليوم" landing-page aggregation (prototype `renderToday()`, reproduced
 * 1:1 visually — see docs/05 + owner decision 2026-07-24 to match the
 * approved prototype exactly). This composes existing gated services rather
 * than querying Prisma directly, so every section keeps its own module
 * gate + row scope; a role missing a module simply sees that section
 * omitted (checked with the non-throwing `canAction`, since this is a
 * shared landing page every role reaches — a throwing `requireModule`
 * would spam the audit log with expected denials on every visit).
 *
 * The client-report / case-internal approval workflow + WhatsApp unread
 * messages panels are NOT reproduced because they have no real backend yet
 * (client portal = Phase 8, WhatsApp = Phase 7). Fabricating them would
 * violate the no-mock-data rule; they return once their phases land.
 * "موظف الأسبوع" now runs on the real PerformanceEvent ledger (src/server/pulse.ts).
 */

export type TodayHearingItem = {
  caseId: string;
  caseTitle: string;
  date: string;
  daysLeft: number;
};

export type TodayDeadlineItem = {
  caseId: string;
  caseTitle: string;
  date: string;
  daysLeft: number;
  label: string;
};

export type TodayApprovalItem =
  | {
      kind: "hrRequest";
      id: string;
      employeeName: string;
      kindLabel: string;
      department: string | null;
      statusLabel: string;
    }
  | {
      kind: "caseApproval";
      id: string;
      title: string;
      caseId: string;
      caseTitle: string;
      stageLabel: string;
    };

export type TodayTaskItem = {
  id: string;
  title: string;
  urgent: boolean;
  dueLabel: string | null;
  caseTitle: string | null;
};

export type TodayEmployeeOfWeek = {
  name: string;
  roleLabel: string;
  points: number;
};

export type TodaySummary = {
  employeeOfWeek: TodayEmployeeOfWeek | null;
  hearings: { visible: boolean; items: TodayHearingItem[]; totalWithin7: number };
  deadlines: { visible: boolean; items: TodayDeadlineItem[]; totalWithin7: number };
  approvals: { visible: boolean; items: TodayApprovalItem[]; total: number };
  tasks: { visible: boolean; items: TodayTaskItem[]; total: number };
  winRate: { visible: boolean; pct: number | null };
};

/** Win-rate KPI (docs/06 §10): (won + partial×0.5) / cases-with-a-recorded-outcome, as a rounded percentage. */
export async function computeWinRate(officeId: string): Promise<number | null> {
  const rows = await prisma.case.groupBy({
    by: ["outcome"],
    where: { officeId, deletedAt: null, outcome: { not: null } },
    _count: { _all: true },
  });
  const countOf = (o: CaseOutcome) => rows.find((r) => r.outcome === o)?._count._all ?? 0;
  const won = countOf(CaseOutcome.WON);
  const partial = countOf(CaseOutcome.PARTIAL);
  const total = rows.reduce((sum, r) => sum + r._count._all, 0);
  if (total === 0) return null;
  return Math.round(((won + partial * 0.5) / total) * 100);
}

function toEmployeeOfWeek(row: PulseRankRow | null): TodayEmployeeOfWeek | null {
  if (!row || row.points <= 0) return null;
  return { name: row.name, roleLabel: row.role ? roleLabel(row.role) : "", points: row.points };
}

const DEADLINE_KIND_LABEL_KEY = {
  objection: "deadlines.objection",
  poa: "deadlines.poa",
  reminder: "deadlines.reminder",
} as const;

export async function getTodaySummary(session: AppSession): Promise<TodaySummary> {
  const [canAppointments, canTasks, canHr, canCases, eowRow] = await Promise.all([
    canAction(session, PermModule.APPOINTMENTS, "view"),
    canAction(session, PermModule.TASKS, "view"),
    canAction(session, PermModule.HR, "view"),
    canAction(session, PermModule.CASES, "view"),
    getEmployeeOfWeek(session.officeId),
  ]);
  const winRatePct = canCases ? await computeWinRate(session.officeId) : null;

  let hearingsAll: TodayHearingItem[] = [];
  let deadlinesAll: TodayDeadlineItem[] = [];
  if (canAppointments) {
    const all = await getDeadlines(session);
    hearingsAll = all
      .filter((d) => d.kind === "nextHearing" && d.daysLeft >= 0)
      .map((d) => ({ caseId: d.caseId, caseTitle: d.caseTitle, date: d.date, daysLeft: d.daysLeft }));
    deadlinesAll = all
      .filter((d) => d.kind !== "nextHearing" && d.daysLeft >= -3 && d.daysLeft <= 45)
      .map((d) => ({
        caseId: d.caseId,
        caseTitle: d.caseTitle,
        date: d.date,
        daysLeft: d.daysLeft,
        label:
          d.kind === "reminder" && d.label
            ? d.label
            : t(DEADLINE_KIND_LABEL_KEY[d.kind as "objection" | "poa" | "reminder"]),
      }));
  }

  let approvalsAll: TodayApprovalItem[] = [];
  if (canHr) {
    const requests = await listRequests(session);
    approvalsAll.push(
      ...requests
        .filter((r) => r.status === RequestStatus.SUBMITTED || r.status === RequestStatus.IN_REVIEW)
        .map((r): TodayApprovalItem => ({
          kind: "hrRequest",
          id: r.id,
          employeeName: r.employee.name,
          kindLabel: requestKindLabel(r.kind),
          department: r.department,
          statusLabel: requestStatusLabel(r.status),
        })),
    );
  }
  if (canCases) {
    const pending = await listPendingApprovals(session);
    approvalsAll.push(
      ...pending
        .filter((a) => a.stage !== ApprovalStage.APPROVED)
        .map((a): TodayApprovalItem => ({
          kind: "caseApproval",
          id: a.id,
          title: a.title,
          caseId: a.case.id,
          caseTitle: a.case.title,
          stageLabel: approvalStageLabel(a.stage),
        })),
    );
  }

  let tasksAll: TodayTaskItem[] = [];
  if (canTasks) {
    const tasks = await listTasks(session);
    tasksAll = tasks
      .filter((tk) => tk.status === TaskColumn.NEW || tk.status === TaskColumn.IN_PROGRESS)
      .sort((a, b) => Number(b.priority === TaskPriority.URGENT) - Number(a.priority === TaskPriority.URGENT))
      .map((tk) => ({
        id: tk.id,
        title: tk.title,
        urgent: tk.priority === TaskPriority.URGENT,
        dueLabel: tk.dueAt ? tk.dueAt.toISOString().slice(0, 10) : null,
        caseTitle: tk.case?.title ?? null,
      }));
  }

  return {
    employeeOfWeek: toEmployeeOfWeek(eowRow),
    hearings: {
      visible: canAppointments,
      items: hearingsAll.slice(0, 6),
      totalWithin7: hearingsAll.filter((h) => h.daysLeft <= 7).length,
    },
    deadlines: {
      visible: canAppointments,
      items: deadlinesAll.slice(0, 6),
      totalWithin7: deadlinesAll.filter((d) => d.daysLeft <= 7).length,
    },
    approvals: {
      visible: canHr || canCases,
      items: approvalsAll.slice(0, 6),
      total: approvalsAll.length,
    },
    tasks: {
      visible: canTasks,
      items: tasksAll.slice(0, 6),
      total: tasksAll.length,
    },
    winRate: { visible: canCases, pct: winRatePct },
  };
}
