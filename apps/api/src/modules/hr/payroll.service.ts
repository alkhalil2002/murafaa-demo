import { Injectable } from "@nestjs/common";
import { ErrorCode, type runPayrollBody } from "@murafaa/contracts";
import { advances, employees, payrollLines, payrollRuns } from "@murafaa/database";
import {
  advanceMonthly,
  advanceRemaining,
  effectiveGosi,
  maskIban,
  payAfterGosi,
  payrollAdvanceDeduction,
  payrollNet,
  payrollPayDate,
  payrollPeriodKey,
  payrollPosting,
} from "@murafaa/rules";
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { writeAudit } from "../../common/audit/audit.js";
import { isUniqueViolation } from "../../common/db/pg-errors.js";
import { ApiException } from "../../common/http/api.exception.js";
import type { Principal } from "../../common/tenancy/principal.js";
import { TenantDb } from "../../database/tenant-db.service.js";
import type { Meta } from "../cases/case-access.service.js";
import { LedgerPoster } from "../finance/ledger-poster.service.js";

const conflict = (key: string) => new ApiException(ErrorCode.CONFLICT, undefined, key);

/**
 * مسيّر الرواتب (legacy server/hr/payroll.ts, wps.ts; docs/06 §8). One run per
 * office and month, all in one transaction: every active employee's line
 * (basic + allowances − GOSI − advance repayment), advances repaid oldest
 * first and never below zero net, and one balanced journal entry:
 * Dr salaries / Cr GOSI payable, employee advances, cash.
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly ledger: LedgerPoster,
  ) {}

  async run(p: Principal, input: z.infer<typeof runPayrollBody>, meta: Meta) {
    const periodKey = payrollPeriodKey(input.year, input.month);
    const payDate = payrollPayDate(input.year, input.month);
    try {
      return await this.tenantDb.run(async (tx) => {
        const staff = await tx
          .select()
          .from(employees)
          .where(and(isNull(employees.deletedAt), eq(employees.status, "ACTIVE")))
          .orderBy(asc(employees.name))
          .for("update");
        if (staff.length === 0) throw conflict("hr.err.NO_ACTIVE_EMPLOYEES");
        // The (office, period) unique index stops a second run, even a concurrent one.
        const [run] = await tx
          .insert(payrollRuns)
          .values({ officeId: p.officeId, periodKey, postedBy: p.userId, createdBy: p.userId })
          .returning({ id: payrollRuns.id });

        const totals = { basic: 0, allowances: 0, gosi: 0, advances: 0, net: 0 };
        for (const e of staff) {
          const gosi = effectiveGosi(e.gosiContribution, e.basicSalary, e.allowances);
          let available = payAfterGosi(e.basicSalary, e.allowances, gosi);
          let advanceDeduction = 0;
          const open = await tx
            .select()
            .from(advances)
            .where(
              and(
                eq(advances.employeeId, e.id),
                eq(advances.status, "ACTIVE"),
                isNull(advances.deletedAt),
              ),
            )
            .orderBy(asc(advances.advanceDate), asc(advances.createdAt))
            .for("update");
          for (const a of open) {
            const ded = payrollAdvanceDeduction({
              installment: advanceMonthly(a),
              remaining: advanceRemaining(a),
              payAfterGosi: available,
            });
            if (ded <= 0) break; // nothing left to repay from this month
            const paid = a.paid + ded;
            await tx
              .update(advances)
              .set({ paid, status: paid >= a.amount ? "SETTLED" : "ACTIVE", updatedBy: p.userId })
              .where(eq(advances.id, a.id));
            advanceDeduction += ded;
            available -= ded;
          }
          const net = payrollNet({
            basic: e.basicSalary,
            allowances: e.allowances,
            gosi,
            advanceDeduction,
          });
          await tx.insert(payrollLines).values({
            officeId: p.officeId,
            payrollRunId: run!.id,
            employeeId: e.id,
            basic: e.basicSalary,
            allowances: e.allowances,
            gosi,
            advanceDeduction,
            net,
            createdBy: p.userId,
          });
          totals.basic += e.basicSalary;
          totals.allowances += e.allowances;
          totals.gosi += gosi;
          totals.advances += advanceDeduction;
          totals.net += net;
        }
        const gross = totals.basic + totals.allowances;
        if (gross <= 0) throw conflict("hr.err.NO_PAYABLE_SALARIES");
        const entry = await this.ledger.post(tx, p.officeId, p.userId, {
          date: new Date(`${payDate}T00:00:00.000Z`),
          descriptionKey: "journal.payroll",
          params: { period: periodKey },
          sourceType: "PAYROLL",
          sourceId: run!.id,
          lines: payrollPosting({
            gross,
            gosi: totals.gosi,
            advances: totals.advances,
            net: totals.net,
          }),
        });
        await tx
          .update(payrollRuns)
          .set({
            totalBasic: totals.basic,
            totalAllowances: totals.allowances,
            totalGosi: totals.gosi,
            totalAdvances: totals.advances,
            totalNet: totals.net,
            journalEntryId: entry.id,
          })
          .where(eq(payrollRuns.id, run!.id));
        await writeAudit(tx, {
          officeId: p.officeId,
          actorId: p.userId,
          action: "payroll.run",
          entity: "payroll_runs",
          entityId: run!.id,
          after: { periodKey, lines: staff.length, totalNet: totals.net },
          ...meta,
        });
        return { id: run!.id };
      });
    } catch (e) {
      if (isUniqueViolation(e, "payroll_runs_period_key"))
        throw conflict("hr.err.PAYROLL_ALREADY_RUN");
      throw e;
    }
  }

  list() {
    return this.tenantDb.run(async (tx) => {
      const rows = await tx
        .select({
          id: payrollRuns.id,
          periodKey: payrollRuns.periodKey,
          totalBasic: payrollRuns.totalBasic,
          totalAllowances: payrollRuns.totalAllowances,
          totalGosi: payrollRuns.totalGosi,
          totalAdvances: payrollRuns.totalAdvances,
          totalNet: payrollRuns.totalNet,
          lineCount: count(payrollLines.id),
        })
        .from(payrollRuns)
        .leftJoin(payrollLines, eq(payrollLines.payrollRunId, payrollRuns.id))
        .where(isNull(payrollRuns.deletedAt))
        .groupBy(payrollRuns.id)
        .orderBy(desc(payrollRuns.periodKey));
      return rows;
    });
  }

  private async load(id: string) {
    return this.tenantDb.run(async (tx) => {
      const [run] = await tx
        .select()
        .from(payrollRuns)
        .where(and(eq(payrollRuns.id, id), isNull(payrollRuns.deletedAt)));
      if (!run) throw new ApiException(ErrorCode.NOT_FOUND);
      const lines = await tx
        .select({
          l: payrollLines,
          employeeName: employees.name,
          nationalId: employees.nationalId,
          iban: employees.iban,
        })
        .from(payrollLines)
        .innerJoin(employees, eq(employees.id, payrollLines.employeeId))
        .where(eq(payrollLines.payrollRunId, id))
        .orderBy(asc(employees.name));
      return { run, lines };
    });
  }

  async detail(id: string) {
    const { run, lines } = await this.load(id);
    return {
      id: run.id,
      periodKey: run.periodKey,
      totalBasic: run.totalBasic,
      totalAllowances: run.totalAllowances,
      totalGosi: run.totalGosi,
      totalAdvances: run.totalAdvances,
      totalNet: run.totalNet,
      journalEntryId: run.journalEntryId,
      lines: lines.map(({ l, employeeName }) => ({
        id: l.id,
        employeeName,
        basic: l.basic,
        allowances: l.allowances,
        gosi: l.gosi,
        advanceDeduction: l.advanceDeduction,
        net: l.net,
      })),
    };
  }

  /**
   * The WPS (حماية الأجور) records of a posted run: read-only, nothing is sent
   * anywhere (Mudad is not connected, M7). IBANs are masked in the response;
   * the bank file export comes with the real integration.
   */
  async wps(p: Principal, id: string, meta: Meta) {
    const { run, lines } = await this.load(id);
    const records = lines.map(({ l, employeeName, nationalId, iban }) => ({
      employeeName,
      nationalId,
      ibanMasked: iban ? maskIban(iban) : null,
      basic: l.basic,
      allowances: l.allowances,
      deductions: l.gosi + l.advanceDeduction,
      net: l.net,
    }));
    // Payroll data with national IDs left the screen: record who looked (PDPL).
    await this.tenantDb.run((tx) =>
      writeAudit(tx, {
        officeId: p.officeId,
        actorId: p.userId,
        action: "payroll.wpsView",
        entity: "payroll_runs",
        entityId: id,
        ...meta,
      }),
    );
    return {
      periodKey: run.periodKey,
      recordCount: records.length,
      totalNet: run.totalNet,
      missingIban: records.filter((r) => !r.ibanMasked).map((r) => r.employeeName),
      records,
    };
  }
}
