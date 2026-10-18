import { AdvanceStatus, EmployeeStatus, PayrollRunStatus, PermModule, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { ACC, assertPeriodOpen, postJournal, withNumberRetry } from "@/lib/finance/ledger";
import {
  advanceMonthly,
  advanceRemaining,
  effectiveGosi,
  payAfterGosi,
  payrollAdvanceDeduction,
  payrollNet,
} from "@/lib/hr/core";

/**
 * Monthly payroll run (prototype PAYROLL_RUNS, docs/02 §13, docs/06 §8).
 * Runs all ACTIVE employees for one (office, period): computes each line
 * (basic + allowances − GOSI − advance deduction), repays outstanding advances
 * oldest-first, and posts ONE balanced double-entry journal — all inside a
 * single DB transaction (money integrity, guardrail 5):
 *
 *   Dr Salaries expense   (basic + allowances)
 *     Cr GOSI payable       (Σ gosi)
 *     Cr Employee advances  (Σ advance deductions — repays the asset)
 *     Cr Cash/bank          (Σ net paid)
 *
 * HR-gated (edit); the resulting ledger posting is a system consequence of the
 * authorized HR action. One run per (office, period) — the unique constraint is
 * the backstop.
 */

const runSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});
export type RunPayrollInput = z.input<typeof runSchema>;

function periodKeyFor(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export async function runPayroll(session: AppSession, raw: RunPayrollInput) {
  await requireModule(session, PermModule.HR, "edit");
  const { year, month } = runSchema.parse(raw);
  const periodKey = periodKeyFor(year, month);
  // Pay date = last calendar day of the month (UTC); its period key == periodKey.
  const payDate = new Date(Date.UTC(year, month, 0));

  const existing = await prisma.payrollRun.findFirst({
    where: { officeId: session.officeId, periodKey, deletedAt: null },
    select: { id: true },
  });
  if (existing) throw new Error("PAYROLL_ALREADY_RUN");

  const run = await withNumberRetry(() =>
    prisma.$transaction(async (tx) => {
      await assertPeriodOpen(tx, session.officeId, payDate);

      const employees = await tx.employee.findMany({
        where: { officeId: session.officeId, deletedAt: null, status: EmployeeStatus.ACTIVE },
        orderBy: { name: "asc" },
      });
      if (employees.length === 0) throw new Error("NO_ACTIVE_EMPLOYEES");

      // The (officeId, periodKey) unique is the true backstop against a
      // concurrent double-submit that both slipped past the pre-check above.
      // Translate its P2002 to the clean domain error so it is NOT retried as a
      // numbering race by withNumberRetry (which retries any P2002).
      let runRow;
      try {
        runRow = await tx.payrollRun.create({
          data: {
            officeId: session.officeId,
            createdById: session.userId,
            postedById: session.userId,
            periodKey,
            status: PayrollRunStatus.POSTED,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          throw new Error("PAYROLL_ALREADY_RUN");
        }
        throw e;
      }

      let totalBasic = 0;
      let totalAllowances = 0;
      let totalGosi = 0;
      let totalAdvances = 0;
      let totalNet = 0;

      for (const emp of employees) {
        // Cap GOSI at the wage so a bad gosi value can never make net negative
        // (which would unbalance the shared journal and block the whole run).
        const gosi = effectiveGosi(emp.gosiContribution, emp.basicSalary, emp.allowances);
        let availableForAdvances = payAfterGosi(emp.basicSalary, emp.allowances, gosi);
        let advanceDeduction = 0;

        // Repay ACTIVE advances oldest-first, capped so net never goes negative.
        const advances = await tx.advance.findMany({
          where: {
            officeId: session.officeId,
            employeeId: emp.id,
            deletedAt: null,
            status: AdvanceStatus.ACTIVE,
          },
          orderBy: { advanceDate: "asc" },
        });
        for (const adv of advances) {
          const remaining = advanceRemaining(adv);
          if (remaining <= 0) continue;
          const ded = payrollAdvanceDeduction({
            installment: advanceMonthly(adv),
            remaining,
            payAfterGosi: availableForAdvances,
          });
          if (ded <= 0) break; // no pay left this month
          // Atomic increment (not read-modify-write) so concurrent runs for
          // different periods cannot lose an update and desync from the ledger.
          const newPaid = adv.paid + ded;
          await tx.advance.update({
            where: { id: adv.id },
            data: {
              paid: { increment: ded },
              ...(newPaid >= adv.amount ? { status: AdvanceStatus.SETTLED } : {}),
            },
          });
          advanceDeduction += ded;
          availableForAdvances -= ded;
        }

        const net = payrollNet({
          basic: emp.basicSalary,
          allowances: emp.allowances,
          gosi,
          advanceDeduction,
        });
        await tx.payrollLine.create({
          data: {
            payrollRunId: runRow.id,
            employeeId: emp.id,
            basic: emp.basicSalary,
            allowances: emp.allowances,
            gosi,
            advanceDeduction,
            net,
          },
        });
        totalBasic += emp.basicSalary;
        totalAllowances += emp.allowances;
        totalGosi += gosi;
        totalAdvances += advanceDeduction;
        totalNet += net;
      }

      const gross = totalBasic + totalAllowances;
      if (gross <= 0) throw new Error("NO_PAYABLE_SALARIES");

      const entry = await postJournal(tx, session.officeId, {
        entryDate: payDate,
        description: `مسيّر رواتب ${periodKey}`,
        sourceType: "PAYROLL",
        sourceId: runRow.id,
        postedById: session.userId,
        lines: [
          { code: ACC.SALARIES_EXPENSE, debit: gross },
          ...(totalGosi > 0 ? [{ code: ACC.GOSI_PAYABLE, credit: totalGosi }] : []),
          ...(totalAdvances > 0 ? [{ code: ACC.EMPLOYEE_ADVANCES, credit: totalAdvances }] : []),
          ...(totalNet > 0 ? [{ code: ACC.CASH_BANK, credit: totalNet }] : []),
        ],
      });

      return tx.payrollRun.update({
        where: { id: runRow.id },
        data: { totalBasic, totalAllowances, totalGosi, totalAdvances, totalNet, journalEntryId: entry.id },
        include: { lines: true },
      });
    }),
  );
  await logAudit({
    session,
    action: "payroll.run",
    resource: "hr",
    targetId: run.id,
    detail: `${periodKey}: net ${run.totalNet}`,
  });
  return run;
}

export async function listPayrollRuns(session: AppSession) {
  await requireModule(session, PermModule.HR, "view");
  return prisma.payrollRun.findMany({
    where: { officeId: session.officeId, deletedAt: null },
    orderBy: { periodKey: "desc" },
    include: { _count: { select: { lines: true } } },
  });
}

export async function getPayrollRun(session: AppSession, runId: string) {
  await requireModule(session, PermModule.HR, "view");
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, officeId: session.officeId, deletedAt: null },
    include: { lines: { include: { employee: { select: { name: true } } } } },
  });
  if (!run) throw new PermissionError("scope");
  return run;
}
