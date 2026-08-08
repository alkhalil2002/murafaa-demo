"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { ExecutionFileStatus } from "@prisma/client";
import {
  openExecution,
  recordCollection,
  addExecutionProcedure,
  cycleExecutionProcedure,
  setExecutionStatus,
} from "@/server/execution";

export async function openExecutionAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  await openExecution(session, caseId, {
    court: String(formData.get("court") ?? "") || null,
    requestNo: String(formData.get("requestNo") ?? "") || null,
    amountMinor: amountRaw ? Math.round(Number(amountRaw) * 100) : null,
    debtor: String(formData.get("debtor") ?? "") || null,
    basis: String(formData.get("basis") ?? "") || null,
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function setExecutionStatusAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const executionId = String(formData.get("executionId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!(status in ExecutionFileStatus)) return;
  await setExecutionStatus(session, executionId, status as ExecutionFileStatus);
  revalidatePath(`/cases/${caseId}`);
}

export async function recordCollectionAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const executionId = String(formData.get("executionId") ?? "");
  const amount = Math.round(Number(formData.get("amount") ?? 0) * 100);
  await recordCollection(session, executionId, amount);
  revalidatePath(`/cases/${caseId}`);
}

export async function addExecutionProcedureAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const executionId = String(formData.get("executionId") ?? "");
  const type = String(formData.get("type") ?? "");
  const note = String(formData.get("note") ?? "");
  await addExecutionProcedure(session, executionId, { type, note: note || null });
  revalidatePath(`/cases/${caseId}`);
}

export async function cycleExecutionProcedureAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const procedureId = String(formData.get("procedureId") ?? "");
  await cycleExecutionProcedure(session, procedureId);
  revalidatePath(`/cases/${caseId}`);
}
