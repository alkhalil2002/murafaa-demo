"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { promoteStage, remandStage, endProcedure, reopenProcedure } from "@/server/cases";

export async function promoteStageAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  await promoteStage(session, caseId);
  revalidatePath(`/cases/${caseId}`);
}

export async function remandStageAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  await remandStage(session, caseId);
  revalidatePath(`/cases/${caseId}`);
}

export async function endProcedureAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const result = String(formData.get("result") ?? "");
  await endProcedure(session, caseId, result);
  revalidatePath(`/cases/${caseId}`);
}

export async function reopenProcedureAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  await reopenProcedure(session, caseId);
  revalidatePath(`/cases/${caseId}`);
}
