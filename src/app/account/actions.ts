"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { confirmTotpEnroll, disableTotp, setOfficeIpAllowlist } from "@/server/security";

export async function confirmTotpEnrollAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const secret = String(formData.get("secret") ?? "");
  const code = String(formData.get("code") ?? "");
  try {
    await confirmTotpEnroll(session, { secret, code });
  } catch {
    redirect("/account/security?err=TOTP_CODE_INVALID");
  }
  revalidatePath("/account/security");
  redirect("/account/security");
}

export async function disableTotpAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  await disableTotp(session);
  revalidatePath("/account/security");
}

export async function setOfficeIpAllowlistAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  const raw = String(formData.get("entries") ?? "");
  await setOfficeIpAllowlist(session, raw.split("\n"));
  revalidatePath("/account/security");
}
