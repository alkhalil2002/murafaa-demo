import { Injectable } from "@nestjs/common";
import {
  accountingPeriods,
  chartOfAccounts,
  journalEntries,
  journalLines,
} from "@murafaa/database";
import { periodKeyFor, riyadhCalendarDate } from "@murafaa/rules";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { writeAudit } from "../../common/audit/audit.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";

type Meta = { ip: string; requestId: string };

/** Chart of accounts, journal and accounting periods (legacy coa/journal pages, finance-governance). */
@Injectable()
export class LedgerService {
  constructor(private readonly tenantDb: TenantDb) {}

  accounts() {
    return this.tenantDb.run((tx) =>
      tx
        .select({
          id: chartOfAccounts.id,
          code: chartOfAccounts.code,
          name: chartOfAccounts.name,
          type: chartOfAccounts.type,
          isActive: chartOfAccounts.isActive,
        })
        .from(chartOfAccounts)
        .orderBy(asc(chartOfAccounts.code)),
    );
  }

  /** The latest journal entries with their lines (newest first). */
  journal(limit = 200) {
    return this.tenantDb.run(async (tx) => {
      const entries = await tx
        .select()
        .from(journalEntries)
        .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
        .limit(limit);
      const ids = entries.map((e) => e.id);
      const lines = ids.length
        ? await tx
            .select({
              entryId: journalLines.journalEntryId,
              code: chartOfAccounts.code,
              name: chartOfAccounts.name,
              debit: journalLines.debit,
              credit: journalLines.credit,
              lineNo: journalLines.lineNo,
            })
            .from(journalLines)
            .innerJoin(chartOfAccounts, eq(chartOfAccounts.id, journalLines.accountId))
            .where(inArray(journalLines.journalEntryId, ids))
            .orderBy(asc(journalLines.lineNo))
        : [];
      return entries.map((e) => ({
        id: e.id,
        entryNo: e.entryNo,
        date: e.entryDate.toISOString().slice(0, 10),
        description: { messageKey: e.descriptionKey, params: e.params ?? {} },
        sourceType: e.sourceType,
        lines: lines
          .filter((l) => l.entryId === e.id)
          .map(({ code, name, debit, credit }) => ({ code, name, debit, credit })),
      }));
    });
  }

  /** The last 12 calendar months (Riyadh) and whether each is locked. */
  periods() {
    return this.tenantDb.run(async (tx) => {
      const today = riyadhCalendarDate();
      const keys = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
        return periodKeyFor(d.getUTCFullYear(), d.getUTCMonth() + 1);
      });
      const rows = await tx
        .select()
        .from(accountingPeriods)
        .where(inArray(accountingPeriods.periodKey, keys));
      return keys.map((k) => ({
        periodKey: k,
        locked: rows.find((r) => r.periodKey === k)?.locked ?? false,
      }));
    });
  }

  /** Lock or reopen a period (FINANCE full). Every posting dated in a locked period is refused. */
  setLock(p: Principal, periodKey: string, locked: boolean, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const values = {
        locked,
        lockedBy: locked ? p.userId : null,
        lockedAt: locked ? new Date() : null,
        updatedBy: p.userId,
      };
      await tx
        .insert(accountingPeriods)
        .values({ officeId: p.officeId, periodKey, ...values, createdBy: p.userId })
        .onConflictDoUpdate({
          target: [accountingPeriods.officeId, accountingPeriods.periodKey],
          set: values,
        });
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: locked ? "period.lock" : "period.unlock",
        entity: "finance",
        after: { periodKey },
        ...meta,
      });
    });
  }
}
