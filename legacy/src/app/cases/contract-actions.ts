"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { addContract, deleteContract, toggleContractSigned } from "@/server/contracts";

export async function addContractAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  await addContract(session, caseId, { title: String(formData.get("title") ?? "") });
  revalidatePath(`/cases/${caseId}`);
}

export async function toggleContractSignedAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  await toggleContractSigned(session, caseId, contractId);
  revalidatePath(`/cases/${caseId}`);
}

export async function deleteContractAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const contractId = String(formData.get("contractId") ?? "");
  await deleteContract(session, caseId, contractId);
  revalidatePath(`/cases/${caseId}`);
}
