"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DocParty } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { addProcedureRequest, cycleProcedureRequestStatus, deleteProcedureRequest, PROC_REQUEST_TYPES } from "@/server/procedure-requests";

export async function addProcedureRequestAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const partyRaw = String(formData.get("party") ?? "");
  const typeRaw = String(formData.get("type") ?? "");
  const type = (PROC_REQUEST_TYPES as readonly string[]).includes(typeRaw)
    ? (typeRaw as (typeof PROC_REQUEST_TYPES)[number])
    : null;
  await addProcedureRequest(session, caseId, {
    stageIndex: Number(formData.get("stageIndex") ?? 0),
    party: partyRaw && partyRaw in DocParty ? (partyRaw as DocParty) : DocParty.OURS,
    type,
    text: String(formData.get("text") ?? "") || typeRaw,
  });
  revalidatePath(`/cases/${caseId}`);
}

export async function cycleProcedureRequestStatusAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  await cycleProcedureRequestStatus(session, caseId, requestId);
  revalidatePath(`/cases/${caseId}`);
}

export async function deleteProcedureRequestAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  await deleteProcedureRequest(session, caseId, requestId);
  revalidatePath(`/cases/${caseId}`);
}
