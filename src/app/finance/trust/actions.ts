"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { trustDeposit, trustWithdraw, trustTransferToFees } from "@/server/trust";
import { riyalsToHalalas } from "@/lib/money";

function moveInputFromForm(formData: FormData) {
  const clientId = String(formData.get("clientId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const note = String(formData.get("note") ?? "");
  const dateRaw = String(formData.get("date") ?? "");
  return {
    clientId,
    amountMinor: riyalsToHalalas(Number(amountRaw) || 0),
    note: note || null,
    date: dateRaw ? new Date(dateRaw) : undefined,
  };
}

export async function trustDepositAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  await trustDeposit(session, moveInputFromForm(formData));
  revalidatePath("/finance/trust");
  const clientId = String(formData.get("clientId") ?? "");
  if (clientId) revalidatePath(`/finance/trust/${clientId}`);
}

export async function trustWithdrawAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  await trustWithdraw(session, moveInputFromForm(formData));
  revalidatePath("/finance/trust");
  const clientId = String(formData.get("clientId") ?? "");
  if (clientId) revalidatePath(`/finance/trust/${clientId}`);
}

export async function trustTransferAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  await trustTransferToFees(session, moveInputFromForm(formData));
  revalidatePath("/finance/trust");
  const clientId = String(formData.get("clientId") ?? "");
  if (clientId) revalidatePath(`/finance/trust/${clientId}`);
}
