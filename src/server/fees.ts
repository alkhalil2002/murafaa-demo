import { FeeType, InvoiceOrigin, PermModule, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { PermissionError, requireModule } from "@/lib/permissions/guard";
import { MAX_HALALAS, feeNet, type FeeAgreementInput } from "@/lib/finance/core";
import { withNumberRetry } from "@/lib/finance/ledger";
import { createInvoiceInTx } from "./invoices";

/**
 * Case fee agreements + fee→invoice generation (docs/06 §3). Fee data is
 * finance-gated (المالية); even though it is set from the case workspace, the
 * server enforces the finance module, not the case module (cross-module rule).
 */

const BASIS_LABEL: Record<FeeType, string> = {
  FLAT: "أتعاب — مبلغ مقطوع",
  RETAINER: "أتعاب شهرية (Retainer)",
  HOURLY: "أتعاب بالساعة",
  PERCENTAGE: "أتعاب — نسبة من المحكوم به",
};

const saveSchema = z.object({
  type: z.nativeEnum(FeeType),
  feeValueMinor: z.number().int().nonnegative().max(MAX_HALALAS).nullish(),
  percentageBps: z.number().int().min(0).max(100_000).nullish(),
  awardedMinor: z.number().int().nonnegative().max(MAX_HALALAS).nullish(),
});
export type SaveFeeInput = z.infer<typeof saveSchema>;

async function assertCaseInOffice(officeId: string, caseId: string) {
  const c = await prisma.case.findFirst({
    where: { id: caseId, officeId, deletedAt: null },
    select: { id: true, clientId: true, title: true },
  });
  if (!c) throw new PermissionError("scope");
  return c;
}

export async function getFeeAgreement(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.FINANCE, "view");
  return prisma.caseFeeAgreement.findFirst({
    where: { caseId, officeId: session.officeId, deletedAt: null },
  });
}

export async function saveFeeAgreement(session: AppSession, caseId: string, raw: SaveFeeInput) {
  await requireModule(session, PermModule.FINANCE, "edit");
  const input = saveSchema.parse(raw);
  await assertCaseInOffice(session.officeId, caseId);
  const agreement = await prisma.caseFeeAgreement.upsert({
    where: { caseId },
    create: {
      officeId: session.officeId,
      createdById: session.userId,
      caseId,
      type: input.type,
      feeValueMinor: input.feeValueMinor ?? null,
      percentageBps: input.percentageBps ?? null,
      awardedMinor: input.awardedMinor ?? null,
    },
    update: {
      type: input.type,
      feeValueMinor: input.feeValueMinor ?? null,
      percentageBps: input.percentageBps ?? null,
      awardedMinor: input.awardedMinor ?? null,
    },
  });
  await logAudit({ session, action: "fee.save", resource: "finance", targetId: caseId, detail: input.type });
  return agreement;
}

/** Unbilled billable time for a case (the hourly-fee basis), in {minutes,rate}. */
async function unbilledTime(db: Prisma.TransactionClient, officeId: string, caseId: string) {
  return db.timeEntry.findMany({
    where: { officeId, caseId, billable: true, invoiced: false, deletedAt: null },
    select: { id: true, minutes: true, hourlyRate: true },
  });
}

/** Generate an invoice from the case's fee agreement (docs FEE-INVOICE-*). */
export async function generateInvoiceFromFee(session: AppSession, caseId: string) {
  await requireModule(session, PermModule.FINANCE, "edit");
  const kase = await assertCaseInOffice(session.officeId, caseId);
  if (!kase.clientId) throw new Error("FEE_INVOICE_NO_CLIENT");

  const invoice = await withNumberRetry(() => prisma.$transaction(async (tx) => {
    const fee = await tx.caseFeeAgreement.findFirst({
      where: { caseId, officeId: session.officeId, deletedAt: null },
    });
    if (!fee) throw new Error("FEE_AGREEMENT_MISSING");

    const timeRows = fee.type === FeeType.HOURLY ? await unbilledTime(tx, session.officeId, caseId) : [];
    const feeInput: FeeAgreementInput = {
      type: fee.type,
      feeValueMinor: fee.feeValueMinor,
      percentageBps: fee.percentageBps,
      awardedMinor: fee.awardedMinor,
    };
    const net = feeNet(feeInput, timeRows.map((t) => ({ minutes: t.minutes, hourlyRate: t.hourlyRate })));
    if (net <= 0) throw new Error("FEE_NET_NONPOSITIVE"); // "حدّد قيمة الأتعاب أولاً"

    const inv = await createInvoiceInTx(tx, session, {
      clientId: kase.clientId!,
      caseId,
      issueDate: new Date(),
      items: [{ description: BASIS_LABEL[fee.type], quantity: 1, unitPrice: net }],
      basis: BASIS_LABEL[fee.type],
      origin: InvoiceOrigin.FEE_AGREEMENT,
    });

    // Hourly: consume the billed time entries so they aren't billed twice.
    if (fee.type === FeeType.HOURLY && timeRows.length) {
      await tx.timeEntry.updateMany({
        where: { id: { in: timeRows.map((t) => t.id) } },
        data: { invoiced: true, invoiceId: inv.id },
      });
    }
    return inv;
  }));

  await logAudit({ session, action: "fee.invoice", resource: "finance", targetId: caseId, detail: invoice.number });
  return invoice;
}
