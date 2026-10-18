import { Injectable } from "@nestjs/common";
import { ErrorCode } from "@murafaa/contracts";
import {
  auditLog,
  clients,
  expenses,
  invoices,
  offices,
  payments,
  type Tx,
  users,
} from "@murafaa/database";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { describeAudit, writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { ExpensesService } from "./expenses.service.js";

type Meta = { ip: string; requestId: string };
const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * الحوكمة (legacy finance-governance + prototype approvePayment/approveExpense):
 * the require-approval switch (partner only), the queue of payments and
 * expenses waiting for approval, and the finance audit trail. Legacy stored
 * the flags but had no way to approve anything; approving an expense posts it.
 * Two people: whoever recorded the entry cannot approve it.
 */
@Injectable()
export class GovernanceService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly expenses: ExpensesService,
  ) {}

  settings() {
    return this.tenantDb.run(async (tx) => {
      const [o] = await tx
        .select({ requireApproval: offices.requireApproval })
        .from(offices)
        .limit(1);
      return { requireApproval: o?.requireApproval ?? false };
    });
  }

  setRequireApproval(p: Principal, value: boolean, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      await tx
        .update(offices)
        .set({ requireApproval: value, updatedBy: p.userId })
        .where(eq(offices.id, p.officeId));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "finance.requireApproval.set",
        entity: "finance",
        after: { value },
        ...meta,
      });
      return { requireApproval: value };
    });
  }

  pending() {
    return this.tenantDb.run(async (tx) => {
      const pays = await tx
        .select({
          id: payments.id,
          number: payments.number,
          invoiceNumber: invoices.number,
          clientName: clients.name,
          amount: payments.amount,
          date: payments.paymentDate,
        })
        .from(payments)
        .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
        .innerJoin(clients, eq(clients.id, invoices.clientId))
        .where(and(eq(payments.isApproved, false), isNull(payments.deletedAt)))
        .orderBy(desc(payments.paymentDate));
      const exps = await tx
        .select()
        .from(expenses)
        .where(and(eq(expenses.approved, false), isNull(expenses.deletedAt)))
        .orderBy(desc(expenses.expenseDate));
      return {
        payments: pays.map((x) => ({ ...x, date: day(x.date) })),
        expenses: exps.map((e) => ({
          id: e.id,
          category: e.category,
          vendor: e.vendor,
          gross: e.netAmount + e.inputVat,
          date: day(e.expenseDate),
        })),
      };
    });
  }

  approvePayment(p: Principal, id: string, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [done] = await tx
        .update(payments)
        .set({
          isApproved: true,
          approvedBy: p.userId,
          approvedAt: new Date(),
          updatedBy: p.userId,
        })
        .where(
          and(
            eq(payments.id, id),
            eq(payments.isApproved, false),
            ne(payments.createdBy, p.userId),
            isNull(payments.deletedAt),
          ),
        )
        .returning({ number: payments.number });
      if (!done) return this.whyNot(tx, payments, id, p.userId);
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "payment.approve",
        entity: "finance",
        entityId: id,
        after: { number: done.number },
        ...meta,
      });
    });
  }

  /** Approving an expense posts its journal entry, once (the flag flips in the same statement). */
  approveExpense(p: Principal, id: string, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [e] = await tx
        .update(expenses)
        .set({ approved: true, approvedBy: p.userId, approvedAt: new Date(), updatedBy: p.userId })
        .where(
          and(
            eq(expenses.id, id),
            eq(expenses.approved, false),
            ne(expenses.createdBy, p.userId),
            isNull(expenses.deletedAt),
          ),
        )
        .returning();
      if (!e) return this.whyNot(tx, expenses, id, p.userId);
      await this.expenses.post(tx, p, e);
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "expense.approve",
        entity: "finance",
        entityId: id,
        ...meta,
      });
    });
  }

  /** Explain a refused approval: not pending (404) or the approver's own entry (403). */
  private async whyNot(
    tx: Tx,
    table: typeof payments | typeof expenses,
    id: string,
    userId: string,
  ): Promise<never> {
    const [row] = await tx
      .select({ createdBy: table.createdBy })
      .from(table)
      .where(eq(table.id, id));
    if (row?.createdBy === userId)
      throw new ApiException(ErrorCode.FORBIDDEN, undefined, "errors.APPROVE_OWN_ENTRY");
    throw new ApiException(ErrorCode.NOT_FOUND);
  }

  audit(limit = 100) {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({
          id: auditLog.id,
          action: auditLog.action,
          after: auditLog.after,
          actorName: users.name,
          at: auditLog.createdAt,
        })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.actorId))
        .where(eq(auditLog.entity, "finance"))
        .orderBy(desc(auditLog.createdAt))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        action: r.action,
        detail: describeAudit(r.after),
        actorName: r.actorName,
        at: r.at.toISOString(),
      }));
    });
  }
}
