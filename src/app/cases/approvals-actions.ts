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
  await createApproval(session, caseId, { title });
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
  await rejectApproval(session, id);
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
