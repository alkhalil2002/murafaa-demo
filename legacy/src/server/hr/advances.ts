import { AdvanceStatus, PermModule } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { MAX_HALALAS } from "@/lib/finance/core";
import { ACC, assertPeriodOpen, postJournal, withNumberRetry } from "@/lib/finance/ledger";
import { advanceMonthly, advanceRemaining } from "@/lib/hr/core";

/**
 * Employee salary advances (prototype ADVANCES, docs/06 §8). Granting an advance
 * moves office cash to the employee: Dr Employee Advances (asset) / Cr Cash — so
 * the later payroll repayment (Cr Employee Advances) nets against a real debit.
 * Repayment itself happens inside the monthly payroll run.
 */

const advanceSchema = z.object({
  employeeId: z.string().uuid(),
  amount: z.number().int().positive().max(MAX_HALALAS),
  months: z.number().int().positive().default(1),
  monthlyInstallment: z.number().int().positive().max(MAX_HALALAS).nullish(),
  advanceDate: z.coerce.date().optional(),
  note: z.string().nullish(),
});
export type CreateAdvanceInput = z.input<typeof advanceSchema>;

export async function createAdvance(session: AppSession, raw: CreateAdvanceInput) {
  await requireModule(session, PermModule.HR, "edit");
  const input = advanceSchema.parse(raw);
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, officeId: session.officeId, deletedAt: null },
    select: { id: true },
  });
  if (!employee) throw new PermissionError("scope");

  // An explicit installment cannot exceed the advance itself.
  if (input.monthlyInstallment != null && input.monthlyInstallment > input.amount) {
    throw new Error("INSTALLMENT_EXCEEDS_AMOUNT");
  }
  // The (possibly derived) monthly installment must be ≥ 1 halala, else payroll
  // would deduct 0 forever and the advance could never settle.
  if (advanceMonthly({ amount: input.amount, monthlyInstallment: input.monthlyInstallment ?? null, months: input.months }) <= 0) {
    throw new Error("INSTALLMENT_TOO_SMALL");
  }
  const date = input.advanceDate ?? new Date();

  const advance = await withNumberRetry(() =>
    prisma.$transaction(async (tx) => {
      await assertPeriodOpen(tx, session.officeId, date);
      const row = await tx.advance.create({
        data: {
          officeId: session.officeId,
          createdById: session.userId,
          employeeId: input.employeeId,
          amount: input.amount,
          months: input.months,
          monthlyInstallment: input.monthlyInstallment ?? null,
          paid: 0,
          advanceDate: date,
          status: AdvanceStatus.ACTIVE,
          note: input.note ?? null,
        },
      });
      await postJournal(tx, session.officeId, {
        entryDate: date,
        description: "سلفة موظف",
        sourceType: "PAYROLL",
        sourceId: row.id,
        postedById: session.userId,
        lines: [
          { code: ACC.EMPLOYEE_ADVANCES, debit: input.amount },
          { code: ACC.CASH_BANK, credit: input.amount },
        ],
      });
      return row;
    }),
  );
  await logAudit({ session, action: "advance.create", resource: "hr", targetId: advance.id });
  return advance;
}

export async function listAdvances(session: AppSession, employeeId?: string) {
  await requireModule(session, PermModule.HR, "view");
  const rows = await prisma.advance.findMany({
    where: { officeId: session.officeId, deletedAt: null, ...(employeeId ? { employeeId } : {}) },
    orderBy: { advanceDate: "desc" },
    include: { employee: { select: { name: true } } },
  });
  return rows.map((a) => ({
    ...a,
    monthlyDue: advanceMonthly(a),
    remaining: advanceRemaining(a),
  }));
}
