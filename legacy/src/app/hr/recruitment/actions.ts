"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { LeadSource } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { createCandidate, moveCandidate, deleteCandidate } from "@/server/hr/recruitment";

export async function createCandidateAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  await createCandidate(session, {
    name: String(formData.get("name") ?? "").trim(),
    roleTitle: String(formData.get("roleTitle") ?? "").trim() || null,
    source: (formData.get("source") as LeadSource) || undefined,
  });
  revalidatePath("/hr/recruitment");
}

export async function moveCandidateAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const dir = Number(formData.get("dir")) === -1 ? -1 : 1;
  await moveCandidate(session, id, dir);
  revalidatePath("/hr/recruitment");
}

export async function deleteCandidateAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  await deleteCandidate(session, id);
  revalidatePath("/hr/recruitment");
}
