import type { Role } from "@prisma/client";

/**
 * The authenticated principal for a request. Every session has an explicit
 * office and role — there is no anonymous "god mode" (docs/04 §6).
 */
export type AppSession = {
  userId: string;
  officeId: string;
  name: string;
  phone: string;
  role: Role;
  /**
   * "معاينة حسب الدور" (docs/05, الصلاحيات screen). Set only when the real
   * `role` is PARTNER and a preview cookie is active — see
   * src/lib/permissions/engine.ts#effectiveRole for how this is applied.
   */
  previewRole?: Role | null;
};
