"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { restoreRecycleItem, purgeRecycleBin, type RecycleKind } from "@/server/settings";
import { updateOfficeBranding } from "@/server/office-settings";

export async function restoreRecycleItemAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  await restoreRecycleItem(session, formData.get("kind") as RecycleKind, String(formData.get("id")));
  revalidatePath("/settings");
}

export async function purgeRecycleBinAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  await purgeRecycleBin(session);
  revalidatePath("/settings");
}

export async function updateOfficeBrandingAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  await updateOfficeBranding(session, {
    name: String(formData.get("name") ?? ""),
    tagline: String(formData.get("tagline") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    email: String(formData.get("email") ?? ""),
    website: String(formData.get("website") ?? ""),
    address: String(formData.get("address") ?? ""),
    licenseNo: String(formData.get("licenseNo") ?? ""),
    primaryColor: String(formData.get("primaryColor") ?? ""),
    accentColor: String(formData.get("accentColor") ?? ""),
    confidentialityNotice: String(formData.get("confidentialityNotice") ?? ""),
  });
  revalidatePath("/settings");
}
