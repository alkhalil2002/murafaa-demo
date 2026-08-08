"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { restoreRecycleItem, purgeRecycleBin, type RecycleKind } from "@/server/settings";

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
