"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { HearingKind } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import {
  recordHearing,
  setNextHearing,
  updateHearing,
  deleteHearing,
  addHearingReminder,
  addHearingTask,
  updateHearingReminder,
  deleteHearingReminder,
  updateHearingTask,
  deleteHearingTask,
  escalateHearingReminder,
  toggleHearingReportFlag,
} from "@/server/hearings";
import { generateHearingReportPdf } from "@/server/documents";

export async function recordHearingAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");

  const caseId = String(formData.get("caseId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  const stageIndexRaw = String(formData.get("stageIndex") ?? "");
  const nextHearingDateRaw = String(formData.get("nextHearingDate") ?? "");

  await recordHearing(session, caseId, {
    hearingDate: new Date(String(formData.get("hearingDate") ?? "")),
    kind: kindRaw && kindRaw in HearingKind ? (kindRaw as HearingKind) : undefined,
    stageIndex: stageIndexRaw ? Number(stageIndexRaw) : null,
    minutes: String(formData.get("minutes") ?? "") || null,
    result: String(formData.get("result") ?? "") || null,
    clientReport: String(formData.get("clientReport") ?? "") || null,
    nextHearingDate: nextHearingDateRaw ? new Date(nextHearingDateRaw) : null,
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function setNextHearingAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const date = String(formData.get("date") ?? "");
  await setNextHearing(session, caseId, new Date(date));
  revalidatePath(`/cases/${caseId}`);
}

export async function updateHearingAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  const stageIndexRaw = String(formData.get("stageIndex") ?? "");
  const hearingDateRaw = String(formData.get("hearingDate") ?? "");
  const recurDaysRaw = String(formData.get("reminderRecurDays") ?? "");

  await updateHearing(session, caseId, hearingId, {
    hearingDate: hearingDateRaw ? new Date(hearingDateRaw) : undefined,
    kind: kindRaw && kindRaw in HearingKind ? (kindRaw as HearingKind) : null,
    stageIndex: stageIndexRaw ? Number(stageIndexRaw) : null,
    minutes: String(formData.get("minutes") ?? "") || null,
    result: String(formData.get("result") ?? "") || null,
    clientReport: String(formData.get("clientReport") ?? "") || null,
    isPending: formData.get("isPending") === "on",
    reminderRecurDays: recurDaysRaw ? Number(recurDaysRaw) : null,
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function deleteHearingAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  await deleteHearing(session, caseId, hearingId);
  revalidatePath(`/cases/${caseId}`);
}

export async function addHearingReminderAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  await addHearingReminder(session, caseId, hearingId, {
    text: String(formData.get("text") ?? ""),
    dueOn: new Date(String(formData.get("dueOn") ?? "")),
    recurIntervalDays: null,
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function addHearingTaskAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "");
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  await addHearingTask(session, caseId, hearingId, {
    title: String(formData.get("title") ?? ""),
    assigneeId: assigneeId || null,
    dueAt: dueAtRaw ? new Date(dueAtRaw) : null,
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function updateHearingReminderAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  const reminderId = String(formData.get("reminderId") ?? "");
  await updateHearingReminder(session, caseId, hearingId, reminderId, {
    text: String(formData.get("text") ?? ""),
    dueOn: new Date(String(formData.get("dueOn") ?? "")),
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function deleteHearingReminderAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  const reminderId = String(formData.get("reminderId") ?? "");
  await deleteHearingReminder(session, caseId, hearingId, reminderId);
  revalidatePath(`/cases/${caseId}`);
}

export async function updateHearingTaskAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "");
  const dueAtRaw = String(formData.get("dueAt") ?? "");
  await updateHearingTask(session, caseId, hearingId, taskId, {
    title: String(formData.get("title") ?? ""),
    assigneeId: assigneeId || null,
    dueAt: dueAtRaw ? new Date(dueAtRaw) : null,
    done: formData.get("done") === "on",
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function deleteHearingTaskAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  await deleteHearingTask(session, caseId, hearingId, taskId);
  revalidatePath(`/cases/${caseId}`);
}

export async function escalateHearingReminderAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  const reminderId = String(formData.get("reminderId") ?? "");
  const assigneeId = String(formData.get("assigneeId") ?? "") || null;
  await escalateHearingReminder(session, caseId, hearingId, reminderId, assigneeId);
  revalidatePath(`/cases/${caseId}`);
}

export async function toggleHearingReportApprovedAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  await toggleHearingReportFlag(session, caseId, hearingId, "reportApproved");
  revalidatePath(`/cases/${caseId}`);
}

export async function toggleHearingReportSentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  await toggleHearingReportFlag(session, caseId, hearingId, "reportSentToClient");
  revalidatePath(`/cases/${caseId}`);
}

export async function generateHearingReportPdfAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  const doc = await generateHearingReportPdf(session, caseId, hearingId);
  redirect(`/api/documents/${doc.id}/download`);
}
