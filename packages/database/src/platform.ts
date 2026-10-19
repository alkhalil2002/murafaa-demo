import { sql } from "drizzle-orm";
import type { Db, Tx } from "./client.js";

/**
 * Run `fn` in a transaction with the platform flag set (إدارة المنصة). Only
 * then are the platform tables and the platform_api functions usable; the
 * flag is transaction-local like withTenant's office id.
 */
export async function withPlatform<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.platform', 'on', true)`);
    return fn(tx);
  });
}

export type PlatformOfficeRow = {
  id: string;
  name: string;
  status: "TRIAL" | "ACTIVE" | "SUSPENDED";
  city: string | null;
  licenseNumber: string | null;
  crNumber: string | null;
  trialEndsAt: string | null;
  paidUntil: string | null;
  suspendedAt: Date | null;
  createdAt: Date;
  users: number;
  cases: number;
  clients: number;
  documents: number;
  storageBytes: number;
  ownerName: string | null;
  ownerPhone: string | null;
};

type RawOffice = {
  id: string;
  name: string;
  status: PlatformOfficeRow["status"];
  city: string | null;
  license_number: string | null;
  cr_number: string | null;
  trial_ends_at: string | null;
  paid_until: string | null;
  suspended_at: string | Date | null;
  created_at: string | Date;
  users: number;
  cases: number;
  clients: number;
  documents: number;
  storage_bytes: string | number;
  owner_name: string | null;
  owner_phone: string | null;
};

const asDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));

/** Every office with its counts (no content), through platform_api.offices(). */
export async function platformOffices(tx: Tx): Promise<PlatformOfficeRow[]> {
  const rows = await tx.execute<RawOffice>(sql`select * from platform_api.offices()`);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    city: r.city,
    licenseNumber: r.license_number,
    crNumber: r.cr_number,
    trialEndsAt: r.trial_ends_at,
    paidUntil: r.paid_until,
    suspendedAt: r.suspended_at === null ? null : asDate(r.suspended_at),
    createdAt: asDate(r.created_at),
    users: r.users,
    cases: r.cases,
    clients: r.clients,
    documents: r.documents,
    storageBytes: Number(r.storage_bytes),
    ownerName: r.owner_name,
    ownerPhone: r.owner_phone,
  }));
}

/** An office's staff accounts: name, role, active, last sign-in. No phones. */
export async function platformOfficeUsers(tx: Tx, officeId: string) {
  const rows = await tx.execute<{
    id: string;
    name: string;
    role: string;
    is_active: boolean;
    last_login_at: string | Date | null;
  }>(sql`select * from platform_api.office_users(${officeId}::uuid)`);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    isActive: r.is_active,
    lastLoginAt: r.last_login_at === null ? null : asDate(r.last_login_at),
  }));
}

/** Status, trial end and paid-until; false when there is no such office. */
export async function platformUpdateOffice(
  tx: Tx,
  officeId: string,
  input: {
    status: PlatformOfficeRow["status"];
    trialEndsAt: string | null;
    paidUntil: string | null;
  },
): Promise<boolean> {
  const [row] = await tx.execute<{ ok: boolean }>(
    sql`select platform_api.update_office(${officeId}::uuid, ${input.status}::office_status, ${input.trialEndsAt}::date, ${input.paidUntil}::date) as ok`,
  );
  return Boolean(row?.ok);
}
