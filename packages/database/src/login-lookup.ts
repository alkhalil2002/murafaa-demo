import { sql } from "drizzle-orm";
import type { Db } from "./client.js";

export type LoginCandidate = { userId: string; officeId: string; totpEnabled: boolean };

/**
 * Active users with this phone across all offices (at most 2), through the
 * narrow auth_api.login_candidates() function — the only cross-office read.
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
