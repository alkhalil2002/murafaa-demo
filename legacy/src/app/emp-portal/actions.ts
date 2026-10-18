"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { destroyEmpPortalSession, getEmpPortalSession } from "@/lib/auth/emp-portal-session";
import { submitEmpRequest, type SubmitEmpRequestInput } from "@/server/emp-portal";

export async function empPortalLogoutAction(): Promise<void> {
  await destroyEmpPortalSession();
  redirect("/emp-portal/login");
}

export async function submitEmpRequestAction(formData: FormData): Promise<void> {
  const session = await getEmpPortalSession();
  if (!session) redirect("/emp-portal/login");

  const kind = String(formData.get("kind") ?? "") as SubmitEmpRequestInput["kind"];
  const daysRaw = formData.get("days");
  await submitEmpRequest(session, {
    kind,
    detail: String(formData.get("detail") ?? "").trim() || null,
    days: daysRaw ? Number(daysRaw) : null,
  });
  revalidatePath("/emp-portal");
}
