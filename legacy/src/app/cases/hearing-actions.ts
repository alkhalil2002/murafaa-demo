"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DocParty, HearingKind } from "@prisma/client";
import { PROC_REQUEST_TYPES } from "@/server/procedure-requests";
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
  requestReportApproval,
  cancelReportApprovalRequest,
  decideReportApproval,
} from "@/server/hearings";
import { generateHearingReportPdf } from "@/server/documents";

export async function recordHearingAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");

  const caseId = String(formData.get("caseId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "");
  const stageIndexRaw = String(formData.get("stageIndex") ?? "");
  const nextHearingDateRaw = String(formData.get("nextHearingDate") ?? "");
  const recurDaysRaw = String(formData.get("reminderRecurDays") ?? "");
  const pendingItems = (["minutes", "nextHearing"] as const).filter(
    (k) => formData.get(`pendingItem_${k}`) === "on",
  );
  const reminderText = String(formData.get("actionReminderText") ?? "").trim();
  const reminderDueOnRaw = String(formData.get("actionReminderDueOn") ?? "");
  const taskTitle = String(formData.get("actionTaskTitle") ?? "").trim();
  const taskAssigneeId = String(formData.get("actionTaskAssigneeId") ?? "");
  const taskDueAtRaw = String(formData.get("actionTaskDueAt") ?? "");
  const requestPartyRaw = String(formData.get("actionRequestParty") ?? "");
  const requestTypeRaw = String(formData.get("actionRequestType") ?? "");
  const requestText = String(formData.get("actionRequestText") ?? "").trim();
  const requestType = (PROC_REQUEST_TYPES as readonly string[]).includes(requestTypeRaw)
    ? (requestTypeRaw as (typeof PROC_REQUEST_TYPES)[number])
    : null;

  await recordHearing(session, caseId, {
    hearingDate: new Date(String(formData.get("hearingDate") ?? "")),
    kind: kindRaw && kindRaw in HearingKind ? (kindRaw as HearingKind) : undefined,
    stageIndex: stageIndexRaw ? Number(stageIndexRaw) : null,
    minutes: String(formData.get("minutes") ?? "") || null,
    result: String(formData.get("result") ?? "") || null,
    clientReport: String(formData.get("clientReport") ?? "") || null,
    nextHearingDate: nextHearingDateRaw ? new Date(nextHearingDateRaw) : null,
    isPending: formData.get("isPending") === "on",
    pendingItems,
    reminderRecurDays: recurDaysRaw ? Number(recurDaysRaw) : null,
    actionReminderText: reminderText || null,
    actionReminderDueOn: reminderDueOnRaw ? new Date(reminderDueOnRaw) : null,
    actionTaskTitle: taskTitle || null,
    actionTaskAssigneeId: taskAssigneeId || null,
    actionTaskDueAt: taskDueAtRaw ? new Date(taskDueAtRaw) : null,
    actionRequestParty: requestPartyRaw && requestPartyRaw in DocParty ? (requestPartyRaw as DocParty) : null,
    actionRequestType: requestType,
    actionRequestText: requestText || null,
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
  const pendingItems = (["minutes", "nextHearing"] as const).filter(
    (k) => formData.get(`pendingItem_${k}`) === "on",
  );

  await updateHearing(session, caseId, hearingId, {
    hearingDate: hearingDateRaw ? new Date(hearingDateRaw) : undefined,
    kind: kindRaw && kindRaw in HearingKind ? (kindRaw as HearingKind) : null,
    stageIndex: stageIndexRaw ? Number(stageIndexRaw) : null,
    minutes: String(formData.get("minutes") ?? "") || null,
    result: String(formData.get("result") ?? "") || null,
    clientReport: String(formData.get("clientReport") ?? "") || null,
    isPending: formData.get("isPending") === "on",
    pendingItems,
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

export async function requestReportApprovalAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  await requestReportApproval(session, caseId, hearingId);
  revalidatePath(`/cases/${caseId}`);
}

export async function cancelReportApprovalRequestAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  await cancelReportApprovalRequest(session, caseId, hearingId);
  revalidatePath(`/cases/${caseId}`);
}

export async function approveReportAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  await decideReportApproval(session, caseId, hearingId, true);
  revalidatePath(`/cases/${caseId}`);
}

export async function rejectReportAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "");
  await decideReportApproval(session, caseId, hearingId, false);
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
