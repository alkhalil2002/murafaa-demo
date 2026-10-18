"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { askAssistant, runArenaRound, resetArena } from "@/server/ai";

export async function askAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const question = String(formData.get("question") ?? "").trim();
  const caseId = String(formData.get("caseId") ?? "") || null;
  if (question) {
    await askAssistant(session, { question, caseId });
  }
  if (caseId) {
    revalidatePath(`/cases/${caseId}`);
  } else {
    revalidatePath("/ai");
  }
}

export async function arenaRoundAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  await runArenaRound(session, caseId);
  revalidatePath(`/ai/arena/${caseId}`);
}

export async function arenaResetAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  await resetArena(session, caseId);
  revalidatePath(`/ai/arena/${caseId}`);
}
