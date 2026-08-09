"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PaymentMethod } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { issueCreditNote, recordPayment, writeOffBadDebt } from "@/server/invoices";
import { createManualJournalEntry } from "@/server/ledger-reports";
import { setPeriodLock, setRequireApproval } from "@/server/finance-governance";
import { reimburseExpense, invoiceTimeEntry, createTimeEntry } from "@/server/expenses";
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
  const caseId = String(formData.get("caseId") ?? "");
  await reimburseExpense(session, expenseId);
  revalidatePath("/finance/expenses");
  if (caseId) revalidatePath(`/cases/${caseId}`);
}

export async function createTimeEntryAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const lawyerId = String(formData.get("lawyerId") ?? "");
  const description = String(formData.get("description") ?? "");
  const hours = Number(formData.get("hours") ?? 0);
  const hourlyRateRiyals = Number(formData.get("hourlyRate") ?? 0);
  const workDateRaw = String(formData.get("workDate") ?? "");
  const billable = formData.get("billable") === "on";
  await createTimeEntry(session, {
    caseId,
    lawyerId,
    description: description || null,
    minutes: Math.round(hours * 60),
    hourlyRate: riyalsToHalalas(hourlyRateRiyals),
    workDate: workDateRaw ? new Date(workDateRaw) : undefined,
    billable,
  });
  revalidatePath("/finance/profitability");
}

export async function invoiceTimeEntryAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const entryId = String(formData.get("entryId") ?? "");
  await invoiceTimeEntry(session, entryId);
  revalidatePath("/finance/profitability");
}

export async function createManualJournalEntryAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const lines = [];
  for (let i = 0; i < 4; i++) {
    const code = String(formData.get(`code${i}`) ?? "").trim();
    if (!code) continue;
    const debit = riyalsToHalalas(Number(formData.get(`debit${i}`) ?? 0));
    const credit = riyalsToHalalas(Number(formData.get(`credit${i}`) ?? 0));
    if (!debit && !credit) continue;
    lines.push({ code, debit, credit });
  }
  try {
    await createManualJournalEntry(session, {
      entryDate: new Date(String(formData.get("entryDate") ?? "")),
      description: String(formData.get("description") ?? ""),
      lines,
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : "ERROR";
    revalidatePath("/finance/journal");
    redirect(`/finance/journal?err=${encodeURIComponent(err)}`);
  }
  revalidatePath("/finance/journal");
  redirect("/finance/journal");
}

export async function setPeriodLockAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const periodKey = String(formData.get("periodKey") ?? "");
  const locked = String(formData.get("locked")) === "true";
  await setPeriodLock(session, { periodKey, locked });
  revalidatePath("/finance/governance");
}

export async function setRequireApprovalAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const value = String(formData.get("value")) === "true";
  await setRequireApproval(session, value);
  revalidatePath("/finance/governance");
}
