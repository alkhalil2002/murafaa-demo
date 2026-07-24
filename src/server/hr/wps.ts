import { PermModule } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";

/**
 * WPS (Wage Protection System / حماية الأجور) file generation from a POSTED
 * payroll run (docs/02 §7, §13). Produces the per-employee wage records a bank /
 * Mudad ingests. Real Mudad/bank API wiring is Phase 7 (integrations); this
 * builds the deterministic file payload. HR-gated (view) — read-only export.
 */

export type WpsRecord = {
  employeeName: string;
  nationalId: string | null;
  iban: string | null;
  basicMinor: number;
  allowancesMinor: number;
  deductionsMinor: number; // gosi + advance repayment
  netMinor: number;
};

export type WpsFile = {
  periodKey: string;
  recordCount: number;
  totalNetMinor: number;
  /** IDs of records missing an IBAN — a bank would reject these. */
  missingIban: string[];
  records: WpsRecord[];
};

export async function generateWpsFile(session: AppSession, runId: string): Promise<WpsFile> {
  await requireModule(session, PermModule.HR, "view");
  const run = await prisma.payrollRun.findFirst({
    where: { id: runId, officeId: session.officeId, deletedAt: null },
    include: {
      lines: {
        include: { employee: { select: { name: true, nationalId: true, iban: true } } },
        orderBy: { employee: { name: "asc" } },
      },
    },
  });
  if (!run) throw new PermissionError("scope");

  const records: WpsRecord[] = run.lines.map((l) => ({
    employeeName: l.employee.name,
    nationalId: l.employee.nationalId,
    iban: l.employee.iban,
    basicMinor: l.basic,
    allowancesMinor: l.allowances,
    deductionsMinor: l.gosi + l.advanceDeduction,
    netMinor: l.net,
  }));
  const missingIban = records.filter((r) => !r.iban).map((r) => r.employeeName);

  await logAudit({ session, action: "payroll.wps", resource: "hr", targetId: runId, detail: run.periodKey });
  return {
    periodKey: run.periodKey,
    recordCount: records.length,
    totalNetMinor: run.totalNet,
    missingIban,
    records,
  };
}
