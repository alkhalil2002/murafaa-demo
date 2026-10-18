"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { destroyPortalSession, getPortalSession } from "@/lib/auth/portal-session";
import { decidePortalApproval, sendPortalMessage, uploadPortalDocument } from "@/server/portal";

export async function portalLogoutAction(): Promise<void> {
  await destroyPortalSession();
  redirect("/portal/login");
}

export async function sendPortalMessageAction(formData: FormData): Promise<void> {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  const caseId = String(formData.get("caseId") ?? "");
  await sendPortalMessage(session, caseId, { body: String(formData.get("body") ?? "") });
  revalidatePath(`/portal/cases/${caseId}`);
}

export async function decidePortalApprovalAction(formData: FormData): Promise<void> {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  const caseId = String(formData.get("caseId") ?? "");
  const approvalId = String(formData.get("approvalId") ?? "");
  const approve = String(formData.get("decision") ?? "") === "approve";
  const note = String(formData.get("note") ?? "").trim() || null;
  await decidePortalApproval(session, caseId, approvalId, approve, note);
  revalidatePath(`/portal/cases/${caseId}`);
}

export async function uploadPortalDocumentAction(formData: FormData): Promise<void> {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  const caseId = String(formData.get("caseId") ?? "");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("UPLOAD_SIZE_REJECTED");
  const bytes = Buffer.from(await file.arrayBuffer());
  await uploadPortalDocument(session, caseId, {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes,
  });
  revalidatePath(`/portal/cases/${caseId}`);
}
