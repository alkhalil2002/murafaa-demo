import { Injectable } from "@nestjs/common";
import { ErrorCode, type expenseBody } from "@murafaa/contracts";
import { cases, clients, expenses, offices, type Tx } from "@murafaa/database";
import { t } from "@murafaa/i18n";
import { expensePosting, expenseSplit, riyadhCalendarDate } from "@murafaa/rules";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import { InvoicesService } from "./invoices.service.js";
import { postJournal } from "./ledger.js";
import { assertClient } from "./trust.service.js";

type Meta = { ip: string; requestId: string };
type ExpenseRow = typeof expenses.$inferSelect;
const conflict = (key: string) => new ApiException(ErrorCode.CONFLICT, undefined, key);

/**
 * Expenses (legacy server/expenses.ts, docs FIN-EXP). Posted Dr expense + Dr
 * input VAT / Cr cash when approved; under the office's require-approval
 * switch they wait, unposted, for a partner (prototype approveExpense).
 */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly invoices: InvoicesService,
  ) {}

  /** The expense's journal entry (in the caller's transaction). */
  async post(tx: Tx, p: Principal, e: ExpenseRow) {
    await postJournal(tx, p.officeId, p.userId, {
      date: e.expenseDate,
      descriptionKey: "journal.expense",
      params: { what: e.vendor ?? `@expCat.${e.category}` },
      sourceType: "EXPENSE",
      sourceId: e.id,
      lines: expensePosting({ net: e.netAmount, vat: e.inputVat, gross: e.netAmount + e.inputVat }),
    });
  }

  create(p: Principal, input: z.infer<typeof expenseBody>, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      // A billable expense may name the client (and case) it is recovered from.
      if (input.billable && input.clientId) await assertClient(tx, input.clientId);
      if (input.billable && input.caseId) {
        const [c] = await tx
          .select({ clientId: cases.clientId })
          .from(cases)
          .where(and(eq(cases.id, input.caseId), isNull(cases.deletedAt)));
        if (!c)
          throw new ApiException(ErrorCode.VALIDATION_FAILED, [
            { path: "caseId", message: "errors.NOT_FOUND" },
          ]);
        if (input.clientId && c.clientId !== input.clientId)
          throw new ApiException(
            ErrorCode.VALIDATION_FAILED,
            undefined,
            "errors.CASE_CLIENT_MISMATCH",
          );
      }
      const [office] = await tx
        .select({ requireApproval: offices.requireApproval })
        .from(offices)
        .limit(1);
      const approved = !office?.requireApproval;
      const { net, vat } = expenseSplit(input.gross, input.explicitVat);
      const [row] = await tx
        .insert(expenses)
        .values({
          officeId: p.officeId,
          expenseDate: input.date ?? riyadhCalendarDate(),
          category: input.category,
          vendor: input.vendor,
          netAmount: net,
          inputVat: vat,
          method: input.method,
          documentNo: input.documentNo,
          billable: input.billable,
          recurring: input.recurring,
          approved,
          approvedBy: approved ? p.userId : null,
          approvedAt: approved ? new Date() : null,
          clientId: input.billable ? (input.clientId ?? null) : null,
          caseId: input.billable ? (input.caseId ?? null) : null,
          createdBy: p.userId,
        })
        .returning();
      if (approved) await this.post(tx, p, row!);
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "expense.create",
        entity: "finance",
        entityId: row!.id,
        after: { gross: net + vat, approved },
        ...meta,
      });
      return { id: row!.id };
    });
  }

  list(caseId?: string) {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({ e: expenses, clientName: clients.name, caseTitle: cases.title })
        .from(expenses)
        .leftJoin(clients, eq(clients.id, expenses.clientId))
        .leftJoin(cases, eq(cases.id, expenses.caseId))
        .where(and(isNull(expenses.deletedAt), caseId ? eq(expenses.caseId, caseId) : undefined))
        .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));
      return rows.map(({ e, clientName, caseTitle }) => ({
        id: e.id,
        date: e.expenseDate.toISOString().slice(0, 10),
        category: e.category,
        vendor: e.vendor,
        net: e.netAmount,
        inputVat: e.inputVat,
        method: e.method,
        documentNo: e.documentNo,
        billable: e.billable,
        billed: e.billed,
        approved: e.approved,
        clientId: e.clientId,
        clientName,
        caseId: e.caseId,
        caseTitle,
      }));
    });
  }

  /** Bill a billable expense to its client; claimed first so it is billed once. */
  reimburse(p: Principal, id: string, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const [e] = await tx
        .update(expenses)
        .set({ billed: true, updatedBy: p.userId })
        .where(
          and(
            eq(expenses.id, id),
            eq(expenses.billable, true),
            eq(expenses.billed, false),
            isNull(expenses.deletedAt),
          ),
        )
        .returning();
      if (!e) throw conflict("errors.EXPENSE_NOT_REIMBURSABLE");
      if (!e.clientId) throw conflict("errors.EXPENSE_NO_CLIENT");
      const what = e.vendor ?? t(`expCat.${e.category}`);
      const inv = await this.invoices.createInTx(tx, p, {
        clientId: e.clientId,
        caseId: e.caseId,
        issueDate: riyadhCalendarDate(),
        items: [
          {
            description: t("invoice.item.reimbursement", { what }),
            quantity: 1,
            unitPrice: e.netAmount,
          },
        ],
        basis: t("invoice.basis.reimbursement"),
        origin: "EXPENSE_REIMBURSEMENT",
        fromExpenseId: e.id,
      });
      await tx
        .update(expenses)
        .set({ reimbursementInvoiceId: inv.id })
        .where(eq(expenses.id, e.id));
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "expense.reimburse",
        entity: "finance",
        entityId: e.id,
        after: { number: inv.number },
        ...meta,
      });
      return inv;
    });
  }
}
