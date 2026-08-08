"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { moveLead, convertLead } from "@/server/leads";

export async function moveLeadAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const dir = Number(formData.get("dir")) === -1 ? -1 : 1;
  await moveLead(session, id, dir);
  revalidatePath("/leads");
}

export async function convertLeadAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  await convertLead(session, id);
  revalidatePath("/leads");
  revalidatePath("/clients");
}
