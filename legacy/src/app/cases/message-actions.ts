"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { sendCaseMessage } from "@/server/messages";

export async function sendCaseMessageAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const caseId = String(formData.get("caseId") ?? "");
  await sendCaseMessage(session, caseId, { body: String(formData.get("body") ?? "") });
  revalidatePath(`/cases/${caseId}`);
}
