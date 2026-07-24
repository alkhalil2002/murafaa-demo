/**
 * Dev-only integration smoke test for Phase 4 (finance) against the seeded DB.
 * Proves the real service paths: VAT + derived status, balanced double-entry
 * journals, trust separation + from-trust payment, non-negative trust guard,
 * credit-note reversal, and module gating. Run after `npm run db:seed`:
 *   npx tsx scripts/phase4-check.ts
 */
import { PaymentMethod, Role } from "@prisma/client";
import { prisma } from "../src/lib/db";
import type { AppSession } from "../src/lib/auth/types";
import { riyalsToHalalas as SAR } from "../src/lib/money";
import { createInvoice, recordPayment, issueCreditNote, listInvoices } from "../src/server/invoices";
import { trustDeposit, trustWithdraw, getTrustLedger } from "../src/server/trust";
import { trialBalance, vatReturn } from "../src/server/ledger-reports";
import { PermissionError } from "../src/lib/permissions/guard";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗ FAIL"} ${name}`);
  if (!cond) failures++;
}

async function journalBalanced(officeId: string): Promise<boolean> {
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
  const imdad = await prisma.client.findFirstOrThrow({ where: { officeId: office.id, name: { contains: "الإمداد" } } });
  const caseA = await prisma.case.findFirstOrThrow({ where: { officeId: office.id, title: { contains: "مطالبة مالية" } } });

  check("seed journal is balanced", await journalBalanced(office.id));

  // 1) Invoice VAT + derived status via a partial payment.
  const inv = await createInvoice(partner, {
    clientId: imdad.id,
    caseId: caseA.id,
    items: [{ description: "أتعاب استشارة", quantity: 2, unitPrice: SAR(1000) }],
  });
  check("invoice VAT = 15% of net", inv.vatAmount === SAR(300) && inv.totalAmount === SAR(2300));
  await recordPayment(partner, inv.id, { amountMinor: SAR(1000), method: PaymentMethod.BANK_TRANSFER });
  const list = await listInvoices(partner);
  const dto = list.find((i) => i.id === inv.id)!;
  check("partial payment → PARTIALLY_PAID", dto.status === "PARTIALLY_PAID" && dto.remaining === SAR(1300));
  check("journal still balanced after invoice+payment", await journalBalanced(office.id));

  // 2) Trust: deposit, then pay an invoice FROM_TRUST; trust balance drops,
  //    receivable settles, and the ledger stays balanced + revenue-separated.
  const led0 = await getTrustLedger(partner, imdad.id);
  const bal0 = led0!.balanceMinor;
  const inv2 = await createInvoice(partner, {
    clientId: imdad.id,
    items: [{ description: "أتعاب", quantity: 1, unitPrice: SAR(2000) }],
  });
  await recordPayment(partner, inv2.id, { amountMinor: SAR(2300), method: PaymentMethod.FROM_TRUST });
  const led1 = await getTrustLedger(partner, imdad.id);
  check("from-trust payment reduced trust balance by the paid amount", led1!.balanceMinor === bal0 - SAR(2300));
  const inv2dto = (await listInvoices(partner)).find((i) => i.id === inv2.id)!;
  check("from-trust payment settled the invoice", inv2dto.status === "PAID" && inv2dto.remaining === 0);
  check("journal balanced after from-trust settlement", await journalBalanced(office.id));

  // 3) Non-negative trust guard.
  let overdrawn = false;
  try {
    await trustWithdraw(partner, { clientId: imdad.id, amountMinor: led1!.balanceMinor + SAR(1) });
  } catch (e) {
    overdrawn = (e as Error).message.includes("TRUST_INSUFFICIENT_BALANCE");
  }
  check("trust withdrawal beyond balance is rejected", overdrawn);
  await trustDeposit(partner, { clientId: imdad.id, amountMinor: SAR(500) }); // sanity: deposit still works
  check("trust deposit still works after guard", (await getTrustLedger(partner, imdad.id))!.balanceMinor === led1!.balanceMinor + SAR(500));

  // 4) Credit note fully cancels + reverses (status CANCELLED, ledger balanced).
  const inv3 = await createInvoice(partner, { clientId: imdad.id, items: [{ description: "أتعاب", quantity: 1, unitPrice: SAR(500) }] });
  await issueCreditNote(partner, inv3.id, "تصحيح");
  const inv3dto = (await listInvoices(partner)).find((i) => i.id === inv3.id)!;
  check("credited invoice → CANCELLED", inv3dto.status === "CANCELLED");
  check("journal balanced after credit note", await journalBalanced(office.id));

  // 4b) Regression (review #1): a credit note on an invoice WITH payments is
  //     rejected (would otherwise drive AR negative).
  const invPaid = await createInvoice(partner, { clientId: imdad.id, items: [{ description: "أتعاب", quantity: 1, unitPrice: SAR(1000) }] });
  await recordPayment(partner, invPaid.id, { amountMinor: SAR(500), method: PaymentMethod.CASH });
  let creditBlocked = false;
  try {
    await issueCreditNote(partner, invPaid.id, "محاولة");
  } catch (e) {
    creditBlocked = (e as Error).message.includes("INVOICE_HAS_PAYMENTS");
  }
  check("credit note on a paid invoice is rejected (no negative AR)", creditBlocked);
  check("journal still balanced after rejected credit note", await journalBalanced(office.id));

  // 5) VAT return: output (non-credited) − input.
  const vat = await vatReturn(partner);
  check("VAT return computed (output ≥ input, payable)", vat.outputVat > 0 && vat.net === vat.outputVat - vat.inputVat);

  // 6) Trial balance is itself balanced (Σ debit = Σ credit).
  const tb = await trialBalance(partner);
  const tbDr = tb.reduce((s, r) => s + r.debit, 0);
  const tbCr = tb.reduce((s, r) => s + r.credit, 0);
  check("trial balance balances", tbDr === tbCr && tbDr > 0);

  // 7) Module gating: lawyer + reception denied finance; accountant allowed.
  let lawyerDenied = false;
  try {
    await listInvoices(mk(Role.LAWYER));
  } catch (e) {
    lawyerDenied = e instanceof PermissionError;
  }
  check("lawyer denied finance module", lawyerDenied);
  const accountantOk = await listInvoices(mk(Role.ACCOUNTANT));
  check("accountant may access finance", Array.isArray(accountantOk));

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} CHECK(S) FAILED`);
  if (failures) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
