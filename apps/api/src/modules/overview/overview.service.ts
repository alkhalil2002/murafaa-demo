import { Injectable } from "@nestjs/common";
import {
  canModule,
  effectiveRole,
  type OfficePolicy,
  type PermAction,
  PermModule,
  SEARCH_CATEGORY_MODULE,
} from "@murafaa/auth";
import { SEARCH_TAKE_PER_CATEGORY } from "@murafaa/contracts";
import { auditLog, users } from "@murafaa/database";
import {
  ACTIVITY_CATEGORIES,
  type ActivityCategory,
  activityCategory,
  type AlertTier,
  deadlineAlertTier,
  inTodayDeadlineWindow,
  sortByTier,
} from "@murafaa/rules";
import { asc, desc, eq } from "drizzle-orm";
import { describeAudit } from "../../common/audit/audit.js";
import { PolicyService } from "../../common/permissions/policy.service.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { AppointmentsService } from "../appointments/appointments.service.js";
import { ApprovalsService } from "../cases/approvals.service.js";
import { CasesService } from "../cases/cases.service.js";
import { type DeadlineItem, DeadlinesService } from "../cases/deadlines.service.js";
import { CrmService } from "../crm/crm.service.js";
import { DocumentsService } from "../documents/documents.service.js";
import { TasksService } from "../tasks/tasks.service.js";

type Message = { messageKey: string; params: Record<string, string | number> };
const msg = (messageKey: string, params: Record<string, string | number>): Message => ({
  messageKey,
  params,
});

const ACTIVITY_TAKE = 100;
const ACTIVITY_COUNT_WINDOW = 2000;

/**
 * Cross-module read views (legacy today/dashboard/journey/alerts/
 * notifications/search/activity). Nothing here is a source of truth: each
 * number is read through the module that owns it, and each section is
 * omitted when the caller's role lacks that module (checked without
 * throwing, so a shared landing page does not log expected denials).
 *
 * Sources whose modules are not rebuilt yet (invoices, HR requests,
 * employees, Team Pulse, WhatsApp) contribute nothing
 * until they land; nothing is fabricated in their place.
 */
@Injectable()
export class OverviewService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly policies: PolicyService,
    private readonly cases: CasesService,
    private readonly crm: CrmService,
    private readonly tasks: TasksService,
    private readonly appointments: AppointmentsService,
    private readonly deadlines: DeadlinesService,
    private readonly approvals: ApprovalsService,
    private readonly documents: DocumentsService,
  ) {}

  private can(policy: OfficePolicy, p: Principal, module: PermModule, action: PermAction = "view") {
    return canModule(policy, effectiveRole(p), module, action);
  }

  private deadlinesFor(policy: OfficePolicy, p: Principal): Promise<DeadlineItem[]> {
    return this.can(policy, p, PermModule.APPOINTMENTS)
      ? this.deadlines.list(p)
      : Promise.resolve([]);
  }

  /** "اليوم" landing page (legacy getTodaySummary). */
  async today(p: Principal) {
    const policy = await this.policies.forOffice(p.officeId);
    const canAppointments = this.can(policy, p, PermModule.APPOINTMENTS);
    const canTasks = this.can(policy, p, PermModule.TASKS);
    const canCases = this.can(policy, p, PermModule.CASES);
    const canHr = this.can(policy, p, PermModule.HR);

    const all = await this.deadlinesFor(policy, p);
    const hearings = all
      .filter((d) => d.kind === "nextHearing" && d.daysLeft >= 0)
      .map((d) => ({
        caseId: d.caseId,
        caseTitle: d.caseTitle,
        date: d.date,
        daysLeft: d.daysLeft,
      }));
    const deadlines = all
      .filter((d) => d.kind !== "nextHearing" && inTodayDeadlineWindow(d.date))
      .map((d) => ({
        caseId: d.caseId,
        caseTitle: d.caseTitle,
        date: d.date,
        daysLeft: d.daysLeft,
        kind: d.kind,
        label: d.label,
      }));

    const open = canTasks
      ? (await this.tasks.list(p))
          .filter((tk) => tk.status === "NEW" || tk.status === "IN_PROGRESS")
          .sort((a, b) => Number(b.priority === "URGENT") - Number(a.priority === "URGENT"))
          .map((tk) => ({
            id: tk.id,
            title: tk.title,
            urgent: tk.priority === "URGENT",
            dueOn: tk.dueAt ? tk.dueAt.slice(0, 10) : null,
            caseTitle: tk.caseTitle,
          }))
      : [];

    const winRatePct = canCases
      ? (await this.tenantDb.run((tx) => this.cases.stats(tx))).winRatePct
      : null;
    // HR leave/advance requests join here with M6.
    const approvals = canCases
      ? (await this.approvals.pending(p)).map((a) => ({
          id: a.id,
          title: a.title,
          caseId: a.caseId,
          caseTitle: a.caseTitle,
          stage: a.stage,
        }))
      : [];

    return {
      employeeOfWeek: null,
      hearings: {
        visible: canAppointments,
        items: hearings.slice(0, 6),
        totalWithin7: hearings.filter((h) => h.daysLeft <= 7).length,
      },
      deadlines: {
        visible: canAppointments,
        items: deadlines.slice(0, 6),
        totalWithin7: deadlines.filter((d) => d.daysLeft <= 7).length,
      },
      approvals: {
        visible: canHr || canCases,
        items: approvals.slice(0, 6),
        total: approvals.length,
      },
      tasks: { visible: canTasks, items: open.slice(0, 6), total: open.length },
      winRate: { visible: canCases, pct: winRatePct },
    };
  }

  /** لوحة المعلومات (legacy getDashboardSummary; route needs REPORTS). */
  async dashboard(p: Principal) {
    const policy = await this.policies.forOffice(p.officeId);
    const { caseStats, clients, openTasks } = await this.tenantDb.run(async (tx) => ({
      caseStats: await this.cases.stats(tx),
      clients: (await this.crm.stats(tx)).clients,
      openTasks: await this.tasks.openCount(tx),
    }));
    const canCases = this.can(policy, p, PermModule.CASES);
    const criticalAlerts = (await this.deadlinesFor(policy, p)).filter(
      (d) => d.urgency === "overdue" || d.urgency === "critical",
    ).length;
    return {
      activeCases: caseStats.activeCases,
      winRatePct: canCases ? caseStats.winRatePct : null,
      criticalAlerts,
      clients,
      openTasks,
      byClassification: canCases ? caseStats.byClassification : [],
    };
  }

  /** رحلة العميل funnel (legacy getJourneySummary; route needs REPORTS). */
  async journey(p: Principal) {
    const policy = await this.policies.forOffice(p.officeId);
    const canClients = this.can(policy, p, PermModule.CLIENTS);
    const canAppointments = this.can(policy, p, PermModule.APPOINTMENTS);
    const canCases = this.can(policy, p, PermModule.CASES);
    const { crm, appts, caseStats } = await this.tenantDb.run(async (tx) => ({
      crm: canClients ? await this.crm.stats(tx) : null,
      appts: canAppointments ? await this.appointments.stats(tx) : null,
      caseStats: canCases ? await this.cases.stats(tx) : null,
    }));
    const leadsByStage = crm?.leadsByStage ?? {
      PROSPECT: 0,
      FIRST_CONSULTATION: 0,
      FEE_PROPOSAL_SENT: 0,
      CONTRACTED: 0,
    };
    const firstContact = Object.values(leadsByStage).reduce((a, b) => a + b, 0);
    const deadlines = await this.deadlinesFor(policy, p);
    const notifications = await this.notifications(p);
    const pendingApprovals = canCases ? (await this.approvals.pending(p)).length : 0;
    return {
      firstContact,
      inboundChats: 0, // WhatsApp (M7)
      leadsByStage,
      inPipeline: firstContact - leadsByStage.CONTRACTED,
      appointments: appts?.total ?? 0,
      followUps: appts?.followUps ?? 0,
      contracted: leadsByStage.CONTRACTED,
      activeCases: caseStats?.activeCases ?? 0,
      pendingApprovals,
      invoicesDue: 0, // invoices (M4)
      uncollected: 0,
      archivedCases: caseStats?.archivedCases ?? 0,
      deadlinesWithin7: deadlines.filter((d) => d.daysLeft >= 0 && d.daysLeft <= 7).length,
      unreadNotifications: notifications.length,
      avgSatisfaction: caseStats?.avgSatisfaction ?? null,
    };
  }

  /** التنبيهات الذكية: three tiers from live signals (legacy getSmartAlerts; route needs ALERTS). */
  async alerts(p: Principal) {
    const policy = await this.policies.forOffice(p.officeId);
    const items: Array<{ id: string; tier: AlertTier; message: Message; href: string }> = [];

    (await this.deadlinesFor(policy, p)).forEach((d, i) => {
      const tier = deadlineAlertTier(d.date);
      if (!tier) return;
      items.push({
        id: `deadline:${d.caseId}:${d.kind}:${d.date}:${i}`,
        tier,
        message: msg(tier === "critical" ? "alerts.deadlineOverdue" : "alerts.deadlineSoon", {
          title: d.caseTitle,
        }),
        href: `/cases/${d.caseId}`,
      });
    });

    if (this.can(policy, p, PermModule.CASES)) {
      const { conflicted, empty } = await this.tenantDb.run((tx) =>
        this.cases.alertCandidates(tx, policy, p),
      );
      for (const c of conflicted) {
        items.push({
          id: `conflict:${c.id}`,
          tier: c.severity === "HIGH" ? "critical" : "important",
          message: msg("alerts.conflict", { title: c.title }),
          href: `/cases/${c.id}`,
        });
      }
      for (const c of empty) {
        items.push({
          id: `empty:${c.id}`,
          tier: "info",
          message: msg("alerts.emptyFile", { title: c.title }),
          href: `/cases/${c.id}`,
        });
      }
    }
    // Overdue invoices join with the finance module (M4).
    return sortByTier(items);
  }

  /** الإشعارات: live feed, newest first (legacy getNotifications). Also the bell count. */
  async notifications(p: Principal) {
    const policy = await this.policies.forOffice(p.officeId);
    const items: Array<{ id: string; message: Message; href: string; at: string }> = [];

    if (this.can(policy, p, PermModule.CASES)) {
      for (const a of await this.approvals.pending(p)) {
        items.push({
          id: `approval:${a.id}`,
          message: msg("notif.approvalPending", {
            title: a.title,
            stage: `@approvalStage.${a.stage}`,
          }),
          href: `/cases/${a.caseId}?tab=approvals`,
          at: a.createdAt.toISOString(),
        });
      }
    }

    for (const d of await this.deadlinesFor(policy, p)) {
      if (d.kind !== "nextHearing" || d.daysLeft < 0 || d.daysLeft > 7) continue;
      items.push({
        id: `hearing:${d.caseId}:${d.date}`,
        message: msg("notif.hearingSoon", { title: d.caseTitle, n: d.daysLeft }),
        href: `/cases/${d.caseId}`,
        at: new Date(`${d.date}T00:00:00.000Z`).toISOString(),
      });
    }
    if (this.can(policy, p, PermModule.TASKS)) {
      for (const tk of await this.tasks.newAssignedTo(p)) {
        items.push({
          id: `task:${tk.id}`,
          message: msg("notif.taskAssigned", { title: tk.title }),
          href: "/tasks",
          at: tk.createdAt.toISOString(),
        });
      }
    }
    // Overdue invoices join here with M4.
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }

  /** Topbar search: each category gated by its module, case-linked rows by the row scope. */
  async search(p: Principal, q: string) {
    const policy = await this.policies.forOffice(p.officeId);
    const allowed = (cat: keyof typeof SEARCH_CATEGORY_MODULE) =>
      this.can(policy, p, SEARCH_CATEGORY_MODULE[cat]);
    const take = SEARCH_TAKE_PER_CATEGORY;
    return this.tenantDb.run(async (tx) => {
      const found = allowed("cases") ? await this.cases.search(tx, policy, p, q, take) : [];
      const people = allowed("clients")
        ? await this.crm.search(tx, q, take)
        : { clients: [], leads: [] };
      const tasks = allowed("tasks") ? await this.tasks.search(tx, policy, p, q, take) : [];
      const docs = allowed("documents") ? await this.documents.search(tx, policy, p, q, take) : [];
      return {
        cases: found.map((c) => ({
          id: c.id,
          label: c.title,
          sub: c.number,
          href: `/cases/${c.id}`,
        })),
        clients: people.clients.map((c) => ({
          id: c.id,
          label: c.name,
          sub: c.phone,
          href: "/clients",
        })),
        leads: people.leads.map((l) => ({ id: l.id, label: l.name, sub: l.phone, href: "/leads" })),
        documents: docs.map((d) => ({
          id: d.id,
          label: d.fileName,
          sub: null,
          href: d.caseId ? `/cases/${d.caseId}?tab=documents` : "/documents",
        })),
        invoices: [], // M4
        tasks: tasks.map((tk) => ({ id: tk.id, label: tk.title, sub: null, href: "/tasks" })),
        employees: [], // M6
      };
    });
  }

  /** سجل النشاط: the whole audit log as a feed, filterable by category and actor (route needs REPORTS). */
  activity(filter: { type?: ActivityCategory; actor?: string }) {
    return this.tenantDb.run(async (tx) => {
      const base = tx
        .select({
          id: auditLog.id,
          action: auditLog.action,
          entity: auditLog.entity,
          after: auditLog.after,
          actorName: users.name,
          at: auditLog.createdAt,
        })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.actorId))
        .$dynamic();
      const rows = await (filter.actor ? base.where(eq(auditLog.actorId, filter.actor)) : base)
        .orderBy(desc(auditLog.createdAt))
        .limit(filter.type ? ACTIVITY_TAKE * 4 : ACTIVITY_TAKE);
      const mapped = rows
        .map((r) => ({
          id: r.id,
          action: r.action,
          entity: r.entity,
          detail: describeAudit(r.after),
          category: activityCategory(r.action, r.entity),
          actorName: r.actorName,
          at: r.at.toISOString(),
        }))
        .filter((r) => !filter.type || r.category === filter.type)
        .slice(0, ACTIVITY_TAKE);

      const actors = await tx
        .select({ id: users.id, name: users.name })
        .from(users)
        .orderBy(asc(users.name));
      const recent = await tx
        .select({ action: auditLog.action, entity: auditLog.entity })
        .from(auditLog)
        .orderBy(desc(auditLog.createdAt))
        .limit(ACTIVITY_COUNT_WINDOW);
      const counts = Object.fromEntries(ACTIVITY_CATEGORIES.map((c) => [c, 0])) as Record<
        ActivityCategory,
        number
      >;
      for (const r of recent) counts[activityCategory(r.action, r.entity)]++;
      return { rows: mapped, actors, counts };
    });
  }
}
