"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { DocParty, ExecutionFileStatus } from "@prisma/client";
import {
  openExecution,
  recordCollection,
  addExecutionProcedure,
  updateExecutionProcedure,
  deleteExecutionProcedure,
  cycleExecutionProcedure,
  setExecutionStatus,
  updateExecution,
  closeExecution,
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

export async function updateExecutionAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const executionId = String(formData.get("executionId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  await updateExecution(session, executionId, {
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

function procedureInputFromForm(formData: FormData) {
  const type = String(formData.get("type") ?? "");
  const note = String(formData.get("note") ?? "");
  const partyRaw = String(formData.get("party") ?? "");
  const dateRaw = String(formData.get("date") ?? "");
  return {
    type,
    note: note || null,
    party: partyRaw && partyRaw in DocParty ? (partyRaw as DocParty) : null,
    date: dateRaw ? new Date(dateRaw) : null,
  };
}

export async function addExecutionProcedureAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const executionId = String(formData.get("executionId") ?? "");
  const followUpDateRaw = String(formData.get("followUpDate") ?? "");
  const followUpAssigneeId = String(formData.get("followUpAssigneeId") ?? "");
  await addExecutionProcedure(session, executionId, {
    ...procedureInputFromForm(formData),
    followUpDate: followUpDateRaw ? new Date(followUpDateRaw) : null,
    followUpAssigneeId: followUpAssigneeId || null,
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function updateExecutionProcedureAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const procedureId = String(formData.get("procedureId") ?? "");
  await updateExecutionProcedure(session, procedureId, procedureInputFromForm(formData));
  revalidatePath(`/cases/${caseId}`);
}

export async function deleteExecutionProcedureAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const procedureId = String(formData.get("procedureId") ?? "");
  await deleteExecutionProcedure(session, procedureId);
  revalidatePath(`/cases/${caseId}`);
}

export async function closeExecutionAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const executionId = String(formData.get("executionId") ?? "");
  await closeExecution(session, executionId);
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
