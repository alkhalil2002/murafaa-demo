import { Role } from "@prisma/client";
import { cookies } from "next/headers";

/**
 * "معاينة حسب الدور" cookie (docs/05 الصلاحيات screen — "شاهد كيف يبدو
 * النظام لكل دور"). Deliberately unsigned: it can only ever RESTRICT what
 * the viewer sees (effectiveRole() in the permission engine ignores it
 * unless the real session role is already PARTNER, and it hard-blocks every
 * non-view action regardless of the previewed role's own grants — see that
 * file's comment), so client-side tampering has no privilege-escalation
 * value. A signed cookie would protect nothing here.
 */

const COOKIE_NAME = "role_preview";

export async function getRolePreviewCookie(): Promise<Role | null> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  return value && value in Role ? (value as Role) : null;
}

export async function setRolePreviewCookie(role: Role): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, role, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function clearRolePreviewCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
