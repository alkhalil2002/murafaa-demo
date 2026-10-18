/**
 * Dev-only integration smoke test for Phase 6 (HR) against the seeded DB.
 * Proves the real service paths: end-of-service (docs/06 §5), Saudization band +
 * needed hires (§6), a monthly payroll run posting a BALANCED double-entry
 * journal with advance deduction (§8), WPS file generation, leave-balance
 * drawdown + guard, and HR module gating. Run after `npm run db:seed`:
 *   npx tsx scripts/phase6-check.ts
 */
import { Role } from "@prisma/client";
import { prisma } from "../src/lib/db";
import type { AppSession } from "../src/lib/auth/types";
import { riyalsToHalalas as SAR } from "../src/lib/money";
import { PermissionError } from "../src/lib/permissions/guard";
import {
  createEmployee,
  createLeave,
  generateWpsFile,
  getSaudizationStatus,
  listEmployees,
  previewEndOfService,
  runPayroll,
  terminateEmployee,
} from "../src/server/hr";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗ FAIL"} ${name}`);
  if (!cond) failures++;
}
async function expectThrow(name: string, fn: () => Promise<unknown>, match?: (e: unknown) => boolean) {
  try {
    await fn();
    check(name, false);
  } catch (e) {
    check(name, match ? match(e) : true);
  }
}

async function ledgerBalanced(officeId: string): Promise<boolean> {
  const lines = await prisma.journalLine.findMany({
    where: { journalEntry: { officeId } },
    select: { debit: true, credit: true },
  });
  const dr = lines.reduce((s, l) => s + l.debit, 0);
  const cr = lines.reduce((s, l) => s + l.credit, 0);
  return dr === cr && dr > 0;
}

async function main() {
  const office = await prisma.office.findFirstOrThrow({ where: { name: { contains: "التجريبي" } } });
  const users = await prisma.user.findMany({ where: { officeId: office.id } });
  const mk = (role: Role): AppSession => {
    const u = users.find((x) => x.role === role)!;
    return { userId: u.id, officeId: office.id, name: u.name, phone: u.phone, role: u.role };
  };
  const partner = mk(Role.PARTNER);
  const admin = mk(Role.ADMIN);
  const accountant = mk(Role.ACCOUNTANT);
  const lawyer = mk(Role.LAWYER);

  check("seed ledger is balanced", await ledgerBalanced(office.id));

  // 1) Seeded staff + Saudization band (4 Saudi of 6 → 66.7% → أخضر متوسط).
  const staff = await listEmployees(partner);
  check("6 employees seeded", staff.length === 6);
  const sz = await getSaudizationStatus(partner);
  check("Saudization: 4 of 6 Saudi", sz.saudiCount === 4 && sz.total === 6);
  check("Saudization band = MID_GREEN (≥60%)", sz.band === "MID_GREEN" && Math.round(sz.pct) === 67);
  const toHigh = sz.targets.find((t) => t.key === "HIGH_GREEN");
  check("needs 4 Saudi hires to reach أخضر مرتفع (80%)", toHigh?.saudisNeeded === 4);

  // 2) End-of-service preview (عبدالرحمن, hired 2018-03 → 8y at 2026): wage 25,000
  //    → 0.5×25000×5 + 25000×3 = 137,500 SAR (docs/06 §5).
  const eng = staff.find((e) => e.name.includes("عبدالرحمن"))!;
  const eos = previewEndOfService(eng, new Date("2026-07-24"));
  check("EOS: 8 years of service", eos.years === 8);
  check("EOS award = 137,500 SAR", eos.awardMinor === SAR(137500));

  // 3) Monthly payroll run posts a balanced journal + deducts the advance.
  const run = await runPayroll(partner, { year: 2026, month: 7 });
  check("payroll: 6 lines", run.lines.length === 6);
  check("payroll totalBasic = 70,000", run.totalBasic === SAR(70000));
  check("payroll totalAllowances = 14,000", run.totalAllowances === SAR(14000));
  check("payroll totalGosi = 5,400", run.totalGosi === SAR(5400));
  check("payroll advance deduction = 2,000", run.totalAdvances === SAR(2000));
  check("payroll totalNet = 76,600 (gross − gosi − advances)", run.totalNet === SAR(76600));
  const monaLine = run.lines.find((l) => l.advanceDeduction > 0)!;
  check("accountant line net = 10,800 after advance", monaLine.net === SAR(10800));
  check("ledger still balanced after payroll", await ledgerBalanced(office.id));

  // The payroll journal itself balances and credits cash by the net.
  const entry = await prisma.journalEntry.findFirstOrThrow({
    where: { officeId: office.id, sourceId: run.id },
    include: { lines: { include: { account: true } } },
  });
  const drSum = entry.lines.reduce((s, l) => s + l.debit, 0);
  const crSum = entry.lines.reduce((s, l) => s + l.credit, 0);
  check("payroll entry balances (Dr=Cr)", drSum === crSum && drSum === SAR(84000));
  const cashLine = entry.lines.find((l) => l.account.code === "1000")!;
  check("payroll credits cash by net", cashLine.credit === SAR(76600));

  // The seeded advance is now partly repaid (2,000 of 6,000), still ACTIVE.
  const advance = await prisma.advance.findFirstOrThrow({ where: { officeId: office.id } });
  check("advance paid 2,000 and still ACTIVE", advance.paid === SAR(2000) && advance.status === "ACTIVE");

  // 4) Re-running the same period is rejected (idempotency).
  await expectThrow(
    "second run for 2026-07 rejected (PAYROLL_ALREADY_RUN)",
    () => runPayroll(partner, { year: 2026, month: 7 }),
    (e) => e instanceof Error && e.message === "PAYROLL_ALREADY_RUN",
  );

  // 5) WPS file from the posted run.
  const wps = await generateWpsFile(partner, run.id);
  check("WPS: 6 records", wps.recordCount === 6);
  check("WPS totalNet matches run", wps.totalNetMinor === run.totalNet);
  check("WPS: all employees have an IBAN", wps.missingIban.length === 0);

  // 5b) GOSI-cap guard: an employee whose GOSI exceeds their wage still yields a
  //     net floored at 0 and a BALANCED run (never JOURNAL_UNBALANCED).
  const capEmp = await createEmployee(partner, {
    name: "موظف بخطأ تأمينات",
    nationality: "سعودي",
    hireDate: new Date("2025-01-01"),
    basicSalary: SAR(10000),
    gosiContribution: SAR(50000),
  });
  const run9 = await runPayroll(partner, { year: 2026, month: 9 });
  const capLine = run9.lines.find((l) => l.employeeId === capEmp.id)!;
  check("GOSI capped at wage → net floored at 0", capLine.net === 0 && capLine.gosi === SAR(10000));
  check("ledger still balanced after capped-GOSI run", await ledgerBalanced(office.id));

  // 6) Leave draws down the balance; overdrawing annual leave is blocked.
  const sara = staff.find((e) => e.name.includes("سارة"))!;
  await createLeave(partner, { employeeId: sara.id, type: "ANNUAL", days: 5, startDate: new Date("2026-08-01") });
  const saraAfter = await prisma.employee.findUniqueOrThrow({ where: { id: sara.id } });
  check("annual leave deducts 5 days (21 → 16)", saraAfter.leaveBalanceDays === 16);
  await expectThrow(
    "overdrawn annual leave blocked",
    () => createLeave(partner, { employeeId: sara.id, type: "ANNUAL", days: 100, startDate: new Date() }),
    (e) => e instanceof Error && e.message === "LEAVE_BALANCE_INSUFFICIENT",
  );

  // 7) Module gating (server-side, no god mode).
  await expectThrow(
    "accountant denied payroll (HR=none)",
    () => runPayroll(accountant, { year: 2026, month: 8 }),
    (e) => e instanceof PermissionError && e.kind === "module",
  );
  await expectThrow(
    "lawyer denied employee list (HR=none)",
    () => listEmployees(lawyer),
    (e) => e instanceof PermissionError && e.kind === "module",
  );

  // 8) ADMIN (HR=edit) may add staff but NOT terminate (full/sensitive only).
  const added = await createEmployee(admin, {
    name: "موظف تجريبي",
    nationality: "سعودي",
    hireDate: new Date("2025-01-01"),
    basicSalary: SAR(5000),
  });
  check("admin (edit) can add an employee", !!added.id);
  await expectThrow(
    "admin denied termination (needs full HR)",
    () => terminateEmployee(admin, added.id),
    (e) => e instanceof PermissionError && e.kind === "module",
  );
  const terminated = await terminateEmployee(partner, added.id);
  check("partner terminates + freezes EOS", terminated.status === "TERMINATED" && terminated.endOfServiceMinor != null);

  console.log(failures === 0 ? "\nAll Phase 6 checks passed ✅" : `\n${failures} check(s) FAILED ❌`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
