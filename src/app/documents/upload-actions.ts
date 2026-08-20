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
  const approvalId = String(formData.get("approvalId") ?? "") || null;
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
      approvalId,
      source: sourceRaw && sourceRaw in DocSource ? (sourceRaw as DocSource) : null,
    },
    bytes,
  );

  revalidatePath(`/cases/${caseId}`);
}

export type DropUploadResult =
  | { ok: true; fileName: string }
  | { ok: false; fileName: string; code: DropUploadError };

export type DropUploadError =
  | "UPLOAD_NO_FILE"
  | "UPLOAD_MIME_REJECTED"
  | "UPLOAD_SIZE_REJECTED"
  | "FORBIDDEN"
  | "GENERIC";

/**
 * Drag-and-drop upload — one file per call.
 *
 * Separate from uploadDocumentAction because that one throws, and a thrown
 * server action surfaces in production as an opaque "an error occurred"
 * digest. Dropping ten files and being told only that something went wrong,
 * with no indication of which file or why, is useless. This returns a result
 * per file so the zone can list exactly what failed.
 *
 * It performs NO validation of its own: same uploadDocument call, so the
 * permission check, the MIME allowlist and the size cap all still apply. The
 * client-side pre-checks in the drop zone are a courtesy, not a gate.
 */
export async function uploadDroppedFileAction(formData: FormData): Promise<DropUploadResult> {
  const file = formData.get("file");
  const fileName = file instanceof File ? file.name : "";

  const session = await getSession();
  if (!session) return { ok: false, fileName, code: "FORBIDDEN" };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, fileName, code: "UPLOAD_NO_FILE" };
  }

  const caseId = String(formData.get("caseId") ?? "");
  try {
    await uploadDocument(
      session,
      {
        caseId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        docType: null,
        party: null,
        hearingId: null,
        sessionLabel: null,
        procedureRequestId: null,
        procedureDocRole: null,
        source: DocSource.UPLOAD,
      },
      Buffer.from(await file.arrayBuffer()),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const code: DropUploadError =
      message === "UPLOAD_MIME_REJECTED" || message === "UPLOAD_SIZE_REJECTED"
        ? message
        : message.includes("PERM") || message.includes("SCOPE")
          ? "FORBIDDEN"
          : "GENERIC";
    return { ok: false, fileName, code };
  }

  revalidatePath(`/cases/${caseId}`);
  return { ok: true, fileName };
}
