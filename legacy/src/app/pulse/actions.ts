"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PerformanceEventKind } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { setPerformanceWeight, resetPerformanceWeight } from "@/server/pulse";

export async function setPerformanceWeightAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const kindRaw = String(formData.get("kind") ?? "");
  const points = Number(formData.get("points") ?? 0);
  if (!(kindRaw in PerformanceEventKind)) return;
  await setPerformanceWeight(session, kindRaw as PerformanceEventKind, points);
  revalidatePath("/pulse");
}

export async function resetPerformanceWeightAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const kindRaw = String(formData.get("kind") ?? "");
  if (!(kindRaw in PerformanceEventKind)) return;
  await resetPerformanceWeight(session, kindRaw as PerformanceEventKind);
  revalidatePath("/pulse");
}
