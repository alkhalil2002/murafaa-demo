"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ClientStatus, ClientType } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { createClient, updateClient } from "@/server/clients";

export async function createClientAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const name = String(formData.get("name") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const city = String(formData.get("city") ?? "");
  const typeRaw = String(formData.get("type") ?? "");
  await createClient(session, {
    name,
    phone: phone || null,
    city: city || null,
    type: typeRaw && typeRaw in ClientType ? (typeRaw as ClientType) : undefined,
  });
  revalidatePath("/clients");
}

export async function updateClientAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const city = String(formData.get("city") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  await updateClient(session, id, {
    name,
    phone: phone || null,
    city: city || null,
    status: statusRaw && statusRaw in ClientStatus ? (statusRaw as ClientStatus) : undefined,
  });
  revalidatePath("/clients");
}
