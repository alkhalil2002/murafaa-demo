"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { destroyPortalSession, getPortalSession } from "@/lib/auth/portal-session";
import { sendPortalMessage } from "@/server/portal";

export async function portalLogoutAction(): Promise<void> {
  await destroyPortalSession();
  redirect("/portal/login");
}

export async function sendPortalMessageAction(formData: FormData): Promise<void> {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  const caseId = String(formData.get("caseId") ?? "");
  await sendPortalMessage(session, caseId, { body: String(formData.get("body") ?? "") });
  revalidatePath(`/portal/cases/${caseId}`);
}
