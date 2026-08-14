"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CaseStatus } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { updateCase, assignUser, unassignUser } from "@/server/cases";

export async function updateCaseAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  // Omitted when blank rather than sent as null: the rule forbids UNLINKING a
  // case, while a case that predates the rule must still be editable.
  const clientIdRaw = String(formData.get("clientId") ?? "").trim();
  const clientId = clientIdRaw || undefined;
  const statusRaw = String(formData.get("status") ?? "");

  await updateCase(session, caseId, {
    number: String(formData.get("number") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    clientRole: (formData.get("clientRole") as "PLAINTIFF" | "DEFENDANT") ?? undefined,
    clientId,
    opposingParty: String(formData.get("opposingParty") ?? "").trim() || null,
    entity: String(formData.get("entity") ?? "").trim() || null,
    najizMainClass: String(formData.get("najizMainClass") ?? "") || null,
    najizSubClass: String(formData.get("najizSubClass") ?? "") || null,
    najizCaseType: String(formData.get("najizCaseType") ?? "") || null,
    city: String(formData.get("city") ?? "") || null,
    status: statusRaw && statusRaw in CaseStatus ? (statusRaw as CaseStatus) : undefined,
  });

  revalidatePath(`/cases/${caseId}`);
}

export async function assignUserAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (userId) await assignUser(session, caseId, userId);
  revalidatePath(`/cases/${caseId}`);
}

export async function unassignUserAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const userName = String(formData.get("userName") ?? "");
  await unassignUser(session, caseId, userId, userName);
  revalidatePath(`/cases/${caseId}`);
}
