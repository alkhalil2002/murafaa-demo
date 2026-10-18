"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DocParty, DocSource, ProcedureRequestDocRole } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { uploadDocument } from "@/server/documents";

export async function uploadDocumentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");

  const caseId = String(formData.get("caseId") ?? "");
  const partyRaw = String(formData.get("party") ?? "");
  const hearingId = String(formData.get("hearingId") ?? "") || null;
  const sessionLabel = String(formData.get("sessionLabel") ?? "") || null;
  const procedureRequestId = String(formData.get("procedureRequestId") ?? "") || null;
  const procedureDocRoleRaw = String(formData.get("procedureDocRole") ?? "");
  const sourceRaw = String(formData.get("source") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("UPLOAD_NO_FILE");

  const bytes = Buffer.from(await file.arrayBuffer());
  await uploadDocument(
    session,
    {
      caseId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      docType: String(formData.get("docType") ?? "") || null,
      party: partyRaw && partyRaw in DocParty ? (partyRaw as DocParty) : null,
      hearingId,
      sessionLabel,
      procedureRequestId,
      procedureDocRole:
        procedureDocRoleRaw && procedureDocRoleRaw in ProcedureRequestDocRole
          ? (procedureDocRoleRaw as ProcedureRequestDocRole)
          : null,
      source: sourceRaw && sourceRaw in DocSource ? (sourceRaw as DocSource) : null,
    },
    bytes,
  );

  revalidatePath(`/cases/${caseId}`);
}
