"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PaymentMethod } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { issueCreditNote, recordPayment, writeOffBadDebt } from "@/server/invoices";
import { reimburseExpense } from "@/server/expenses";
import { riyalsToHalalas } from "@/lib/money";

export async function recordPaymentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const riyals = Number(formData.get("amount") ?? 0);
  const method = String(formData.get("method") ?? "BANK_TRANSFER") as PaymentMethod;
  const reference = (formData.get("reference") as string) || null;
  if (riyals > 0) {
    await recordPayment(session, invoiceId, {
      amountMinor: riyalsToHalalas(riyals),
      method,
      reference,
    });
  }
  revalidatePath(`/finance/${invoiceId}`);
  revalidatePath("/finance");
}

export async function creditNoteAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const reason = (formData.get("reason") as string) || "إلغاء الفاتورة";
  await issueCreditNote(session, invoiceId, reason);
  revalidatePath(`/finance/${invoiceId}`);
  revalidatePath("/finance");
}

export async function writeOffAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const invoiceId = String(formData.get("invoiceId") ?? "");
  await writeOffBadDebt(session, invoiceId);
  revalidatePath(`/finance/${invoiceId}`);
  revalidatePath("/finance");
}

export async function reimburseExpenseAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const expenseId = String(formData.get("expenseId") ?? "");
  await reimburseExpense(session, expenseId);
  revalidatePath("/finance/expenses");
}
