"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import {
  toggleClosingChecklistItem,
  setClientSatisfaction,
  requestReferral,
  archiveCase,
  CLOSING_CHECKLIST_ITEMS,
  type ClosingChecklistKey,
} from "@/server/cases";

export async function toggleChecklistAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const key = String(formData.get("key") ?? "");
  if (!(CLOSING_CHECKLIST_ITEMS as readonly string[]).includes(key)) return;
  await toggleClosingChecklistItem(session, caseId, key as ClosingChecklistKey);
  revalidatePath(`/cases/${caseId}`);
}

export async function setCsatAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const score = Number(formData.get("score") ?? 0);
  await setClientSatisfaction(session, caseId, score);
  revalidatePath(`/cases/${caseId}`);
}

export async function requestReferralAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  await requestReferral(session, caseId);
  revalidatePath(`/cases/${caseId}`);
}

export async function archiveCaseAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  await archiveCase(session, caseId);
  revalidatePath(`/cases/${caseId}`);
  revalidatePath("/cases");
}
