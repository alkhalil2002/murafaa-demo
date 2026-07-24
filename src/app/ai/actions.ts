"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArenaRole } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import { askAssistant, runArenaTurn } from "@/server/ai";

export async function askAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const question = String(formData.get("question") ?? "").trim();
  if (question) {
    await askAssistant(session, { question });
  }
  revalidatePath("/ai");
}

export async function arenaTurnAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  const role = String(formData.get("role") ?? "OURS") as ArenaRole;
  await runArenaTurn(session, { caseId, role, threadId: `arena:${caseId}` });
  revalidatePath(`/ai/arena/${caseId}`);
}
