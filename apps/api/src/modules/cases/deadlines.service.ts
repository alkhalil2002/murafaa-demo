import { Injectable } from "@nestjs/common";
import { caseReminders, cases, hearings } from "@murafaa/database";
import { daysLeft, type DeadlineKind, riyadhCalendarDate, urgencyOf } from "@murafaa/rules";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { PolicyService } from "../../common/permissions/policy.service.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { caseVisibility } from "./case-scope.js";

export type DeadlineItem = {
  kind: DeadlineKind;
  date: string;
  daysLeft: number;
  urgency: ReturnType<typeof urgencyOf>;
  caseId: string;
  caseTitle: string;
  label: string | null;
  recurIntervalDays: number | null;
};

/**
 * Case-derived calendar (legacy server/deadlines.ts, docs/06 §9): the next
 * hearing, objection deadline, POA expiry and case reminders of every case
 * the caller may see, soonest (overdue) first.
 */
@Injectable()
export class DeadlinesService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly policies: PolicyService,
  ) {}

  async list(p: Principal): Promise<DeadlineItem[]> {
    const policy = await this.policies.forOffice(p.officeId);
    return this.tenantDb.run(async (tx) => {
      const visible = await tx
        .select({
          id: cases.id,
          title: cases.title,
          objectionDueAt: cases.objectionDueAt,
          poaExpiresAt: cases.poaExpiresAt,
        })
        .from(cases)
        .where(caseVisibility(tx, policy, p));
      if (visible.length === 0) return [];
      const ids = visible.map((c) => c.id);
      const [upcoming, reminders] = await Promise.all([
        tx
          .select({ caseId: hearings.caseId, date: hearings.hearingDate })
          .from(hearings)
          .where(
            and(
              inArray(hearings.caseId, ids),
              eq(hearings.status, "UPCOMING"),
              isNull(hearings.deletedAt),
            ),
          ),
        tx
          .select({
            caseId: caseReminders.caseId,
            text: caseReminders.text,
            dueOn: caseReminders.dueOn,
            recur: caseReminders.recurIntervalDays,
          })
          .from(caseReminders)
          .where(and(inArray(caseReminders.caseId, ids), isNull(caseReminders.deletedAt))),
      ]);

      const title = new Map(visible.map((c) => [c.id, c.title]));
      const items: DeadlineItem[] = [];
      const push = (
        kind: DeadlineKind,
        date: Date,
        caseId: string,
        label: string | null = null,
        recur: number | null = null,
      ) =>
        items.push({
          kind,
          date: riyadhCalendarDate(date).toISOString().slice(0, 10),
          daysLeft: daysLeft(date),
          urgency: urgencyOf(date),
          caseId,
          caseTitle: title.get(caseId) ?? "",
          label,
          recurIntervalDays: recur,
        });
      for (const h of upcoming) push("nextHearing", h.date, h.caseId);
      for (const c of visible) {
        if (c.objectionDueAt) push("objection", c.objectionDueAt, c.id);
        if (c.poaExpiresAt) push("poa", c.poaExpiresAt, c.id);
      }
      for (const r of reminders) push("reminder", r.dueOn, r.caseId, r.text, r.recur);
      return items.sort((a, b) => a.daysLeft - b.daysLeft);
    });
  }
}
