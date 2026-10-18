import { Injectable } from "@nestjs/common";
import { ErrorCode } from "@murafaa/contracts";
import { clients, expenses, invoices, payments, trustAccounts } from "@murafaa/database";
import { t } from "@murafaa/i18n";
import { and, eq, isNull } from "drizzle-orm";
import { writeAudit } from "../../common/audit/audit.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";

type Meta = { ip: string; requestId: string };
type Account = "CURRENT" | "CASH" | "CHEQUE";

/** Which receipt/expense methods settle into which account (legacy finance-bank). */
const METHODS: Record<
  Account,
  {
    pay: Array<"BANK_TRANSFER" | "MADA" | "CASH" | "CHEQUE">;
    exp: Array<"BANK_TRANSFER" | "MADA" | "CASH" | "CHEQUE">;
  }
> = {
  CURRENT: { pay: ["BANK_TRANSFER", "MADA"], exp: ["BANK_TRANSFER", "MADA"] },
  CASH: { pay: ["CASH"], exp: ["CASH"] },
  CHEQUE: { pay: ["CHEQUE"], exp: ["CHEQUE"] },
};

/**
 * البنوك والصندوق (legacy finance-bank): money by where it sits, from the
 * methods recorded on receipts and posted expenses (receipts from trust stay
 * in the trust ledger), plus a reconciliation ledger whose lines are marked
 * cleared against the real statement.
 */
@Injectable()
export class BankService {
  constructor(private readonly tenantDb: TenantDb) {}

  view(account: Account) {
    return this.tenantDb.run(async (tx) => {
      const pays = await tx
        .select({
          id: payments.id,
          method: payments.method,
          amount: payments.amount,
          date: payments.paymentDate,
          cleared: payments.cleared,
          invoiceNumber: invoices.number,
          clientName: clients.name,
        })
        .from(payments)
        .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
        .innerJoin(clients, eq(clients.id, invoices.clientId))
        .where(and(isNull(payments.deletedAt), isNull(invoices.deletedAt)));
      // Only posted (approved) expenses have left the books' cash.
      const exps = await tx
        .select()
        .from(expenses)
        .where(and(isNull(expenses.deletedAt), eq(expenses.approved, true)));
      const trust = await tx
        .select({ balance: trustAccounts.balance })
        .from(trustAccounts)
        .where(isNull(trustAccounts.deletedAt));

      const flow = (a: Account) => ({
        inflow: pays
          .filter((x) => (METHODS[a].pay as string[]).includes(x.method))
          .reduce((s, x) => s + x.amount, 0),
        outflow: exps
          .filter((e) => METHODS[a].exp.includes(e.method))
          .reduce((s, e) => s + e.netAmount + e.inputVat, 0),
      });
      const ledger = [
        ...pays
          .filter((x) => (METHODS[account].pay as string[]).includes(x.method))
          .map((x) => ({
            kind: "PAYMENT" as const,
            id: x.id,
            date: x.date,
            amount: x.amount,
            label: `${x.invoiceNumber} — ${x.clientName}`,
            cleared: x.cleared,
          })),
        ...exps
          .filter((e) => METHODS[account].exp.includes(e.method))
          .map((e) => ({
            kind: "EXPENSE" as const,
            id: e.id,
            date: e.expenseDate,
            amount: -(e.netAmount + e.inputVat),
            label: e.vendor ?? t(`expCat.${e.category}`),
            cleared: e.cleared,
          })),
      ]
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((r) => ({ ...r, date: r.date.toISOString().slice(0, 10) }));
      return {
        current: flow("CURRENT"),
        cash: flow("CASH"),
        cheques: flow("CHEQUE"),
        trustBalance: trust.reduce((s, r) => s + r.balance, 0),
        account,
        ledger,
      };
    });
  }

  /** Mark a receipt or expense line cleared (or not) against the statement. */
  toggleCleared(p: Principal, kind: "PAYMENT" | "EXPENSE", id: string, meta: Meta) {
    return this.tenantDb.run(async (tx) => {
      const now = new Date();
      const flip = <T extends { cleared: boolean }>(row: T | undefined) => {
        if (!row) throw new ApiException(ErrorCode.NOT_FOUND);
        return { cleared: !row.cleared, clearedAt: row.cleared ? null : now, updatedBy: p.userId };
      };
      let cleared: boolean;
      if (kind === "PAYMENT") {
        const [row] = await tx
          .select({ cleared: payments.cleared })
          .from(payments)
          .where(and(eq(payments.id, id), isNull(payments.deletedAt)));
        const next = flip(row);
        await tx.update(payments).set(next).where(eq(payments.id, id));
        cleared = next.cleared;
      } else {
        const [row] = await tx
          .select({ cleared: expenses.cleared })
          .from(expenses)
          .where(and(eq(expenses.id, id), isNull(expenses.deletedAt)));
        const next = flip(row);
        await tx.update(expenses).set(next).where(eq(expenses.id, id));
        cleared = next.cleared;
      }
      await writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "bank.toggleCleared",
        entity: "finance",
        entityId: id,
        after: { kind, cleared },
        ...meta,
      });
    });
  }
}
