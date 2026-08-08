"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { advanceApproval, createApproval, deleteApproval, rejectApproval } from "@/server/approvals";

export async function createApprovalAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const title = String(formData.get("title") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "") || null;
  await createApproval(session, caseId, { title, hearingId });
  revalidatePath(`/cases/${caseId}`);
}

export async function advanceApprovalAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  await advanceApproval(session, id);
  revalidatePath(`/cases/${caseId}`);
}

export async function rejectApprovalAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  const note = String(formData.get("note") ?? "");
  await rejectApproval(session, id, note || null);
  revalidatePath(`/cases/${caseId}`);
}

export async function deleteApprovalAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  await deleteApproval(session, id);
  revalidatePath(`/cases/${caseId}`);
}
