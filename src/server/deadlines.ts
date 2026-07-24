import { HearingStatus, PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";
import { requireModule } from "@/lib/permissions/guard";
import { caseScopeWhere } from "@/lib/permissions/scope";
import { daysLeft, urgencyOf, type Urgency } from "@/lib/dates";

/**
 * Deadlines aggregation (docs/06 §9, BR-CAL-aggregation). Gathers case-derived
 * deadlines (next hearing, objection deadline, POA expiry, case reminders) for
 * every case the caller may see (row-scope applied), sorted by urgency. All
 * items carry a computed days-left + urgency band so the UI never recomputes.
 *
 * NOTE: POA expiry is included here as a unified calendar item (readers'
 * recommendation); the prototype showed it on the dashboard only. Owner may
 * decide to split surfaces later.
 */

export type DeadlineKind = "nextHearing" | "objection" | "poa" | "reminder";

export type DeadlineItem = {
  kind: DeadlineKind;
  date: string; // ISO yyyy-mm-dd
  daysLeft: number;
  urgency: Urgency;
  caseId: string;
  caseTitle: string;
  /** For reminders: the reminder text; recurrence interval when recurring. */
  label?: string;
  recurIntervalDays?: number | null;
};

export async function getDeadlines(session: AppSession): Promise<DeadlineItem[]> {
  await requireModule(session, PermModule.APPOINTMENTS, "view");
  const where = await caseScopeWhere(session);

  const cases = await prisma.case.findMany({
    where,
    select: {
      id: true,
      title: true,
      objectionDueAt: true,
      poaExpiresAt: true,
      hearings: {
        where: { status: HearingStatus.UPCOMING, deletedAt: null },
        orderBy: { hearingDate: "asc" },
        take: 1,
        select: { hearingDate: true },
      },
      reminders: {
        where: { deletedAt: null },
        select: { text: true, dueOn: true, recurIntervalDays: true },
      },
    },
  });

  const items: DeadlineItem[] = [];
  const push = (kind: DeadlineKind, date: Date, caseId: string, caseTitle: string, extra?: Partial<DeadlineItem>) => {
    items.push({
      kind,
      date: date.toISOString().slice(0, 10),
      daysLeft: daysLeft(date),
      urgency: urgencyOf(date),
      caseId,
      caseTitle,
      ...extra,
    });
  };

  for (const c of cases) {
    const next = c.hearings[0];
    if (next) push("nextHearing", next.hearingDate, c.id, c.title);
    if (c.objectionDueAt) push("objection", c.objectionDueAt, c.id, c.title);
    if (c.poaExpiresAt) push("poa", c.poaExpiresAt, c.id, c.title);
    for (const r of c.reminders) {
      push("reminder", r.dueOn, c.id, c.title, {
        label: r.text,
        recurIntervalDays: r.recurIntervalDays,
      });
    }
  }

  // Soonest first (overdue floats to the top by daysLeft ascending).
  items.sort((a, b) => a.daysLeft - b.daysLeft);
  return items;
}
