"use server";

import { PermLevel, CaseScope, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { setModuleLevel, setRoleCaseScope, setUserRole } from "@/server/permissions-admin";
import { setRolePreviewCookie, clearRolePreviewCookie } from "@/lib/auth/role-preview";

/**
 * "معاينة حسب الدور" — checks the REAL session.role (not effectiveRole),
 * so a partner can always start or end a preview regardless of whatever
 * role is currently being previewed.
 */
export async function setRolePreviewAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== Role.PARTNER) throw new Error("PARTNER_ONLY");
  await setRolePreviewCookie(formData.get("role") as Role);
  redirect("/today");
}

export async function clearRolePreviewAction(): Promise<void> {
  await clearRolePreviewCookie();
  redirect("/today");
}

export async function setModuleLevelAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  await setModuleLevel(session, {
    role: formData.get("role") as never,
    module: formData.get("module") as never,
    level: formData.get("level") as PermLevel,
  });
  revalidatePath("/perms");
}

export async function setRoleCaseScopeAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  await setRoleCaseScope(session, {
    role: formData.get("role") as never,
    scope: formData.get("scope") as CaseScope,
  });
  revalidatePath("/perms");
}

export async function setUserRoleAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");
  await setUserRole(session, {
    userId: String(formData.get("userId")),
    role: formData.get("role") as never,
  });
  revalidatePath("/perms/users");
}
