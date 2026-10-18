import { sql } from "drizzle-orm";
import type { Db } from "./client.js";

export type LoginCandidate = { userId: string; officeId: string; totpEnabled: boolean };

/**
 * Active users with this phone across all offices (at most 2), through the
 * narrow auth_api.login_candidates() function (with portalCandidates, the only cross-office reads).
 * More than one match means the phone is ambiguous and login must not guess.
 */
export async function loginCandidates(db: Db, phone: string): Promise<LoginCandidate[]> {
  const rows = await db.execute<{ user_id: string; office_id: string; totp_enabled: boolean }>(
    sql`select user_id, office_id, totp_enabled from auth_api.login_candidates(${phone})`,
  );
  return rows.map((r) => ({
    userId: r.user_id,
    officeId: r.office_id,
    totpEnabled: r.totp_enabled,
  }));
}

export type PortalKind = "CLIENT" | "EMPLOYEE";

/**
 * Portal sign-in: the client or employee with this phone, through the narrow
 * auth_api.portal_candidates() function. More than one match is ambiguous
 * and must not sign anyone in.
 */
export async function portalCandidates(
  db: Db,
  phone: string,
  kind: PortalKind,
): Promise<Array<{ subjectId: string; officeId: string }>> {
  const rows = await db.execute<{ subject_id: string; office_id: string }>(
    sql`select subject_id, office_id from auth_api.portal_candidates(${phone}, ${kind})`,
  );
  return rows.map((r) => ({ subjectId: r.subject_id, officeId: r.office_id }));
}
