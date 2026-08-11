import { notFound } from "next/navigation";

/**
 * Dynamic-segment validation.
 *
 * Next.js matches `/finance/[id]` against ANY single segment, so a stray path
 * like /finance/invoices arrives as id="invoices" and goes straight into a
 * Prisma `where: { id }` on a uuid column — which throws P2023 ("Inconsistent
 * column data: Error creating UUID") and renders a 500 error page instead of a
 * 404. Guarding the segment turns a typo'd or probed URL into an ordinary
 * not-found.
 *
 * Deliberately lenient on the version/variant nibbles: this exists to reject
 * non-UUID junk before it reaches the database, not to enforce RFC 4122
 * versioning on ids the database already issued.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Render the 404 page unless `value` is a UUID. For server components — throws
 * Next's NEXT_NOT_FOUND signal, so it never returns on the failure path.
 */
export function requireUuidParam(value: string): string {
  if (!isUuid(value)) notFound();
  return value;
}
