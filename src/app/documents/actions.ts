"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import {
  generateFromTemplate,
  softDeleteDocument,
  toggleShare,
} from "@/server/documents";

/** Generate a document from a template with the submitted field values. */
export async function generateAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");

  const templateKey = String(formData.get("templateKey") ?? "");
  const caseId = (formData.get("caseId") as string) || null;
  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("field_")) values[k.slice("field_".length)] = String(v);
  }

  const doc = await generateFromTemplate(session, { templateKey, caseId, values });

  if (caseId) {
    revalidatePath(`/cases/${caseId}`);
    redirect(`/cases/${caseId}`);
  }
  redirect(`/api/documents/${doc.id}/download`);
}

export async function shareDocumentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  await toggleShare(session, id);
  if (caseId) revalidatePath(`/cases/${caseId}`);
}

export async function deleteDocumentAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const caseId = String(formData.get("caseId") ?? "");
  await softDeleteDocument(session, id);
  if (caseId) revalidatePath(`/cases/${caseId}`);
}
