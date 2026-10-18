"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ClientCommunicationType } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { addClientCommunication, deleteClientCommunication } from "@/server/communications";

export async function addClientCommunicationAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const typeRaw = String(formData.get("type") ?? "");
  await addClientCommunication(session, caseId, {
    type: typeRaw && typeRaw in ClientCommunicationType ? (typeRaw as ClientCommunicationType) : ClientCommunicationType.CALL,
    note: String(formData.get("note") ?? ""),
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function deleteClientCommunicationAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const commId = String(formData.get("commId") ?? "");
  await deleteClientCommunication(session, caseId, commId);
  revalidatePath(`/cases/${caseId}`);
}
