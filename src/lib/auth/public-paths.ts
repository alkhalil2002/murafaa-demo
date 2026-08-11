/**
 * Paths the staff Auth.js session gate must NOT redirect to /login.
 *
 * Kept out of middleware.ts (and free of any next-auth import) so it stays
 * Edge-safe and unit-testable — the middleware wrapper itself can't easily be
 * exercised in vitest.
 *
 * The two portals each carry their own session (portal-session.ts,
 * emp-portal-session.ts) and check it in-page, so the staff gate must let them
 * through. Their OTP endpoints must be public for the same reason: a portal
 * user is by definition not staff-authenticated when requesting a code.
 */
const PUBLIC_EXACT = new Set(["/login", "/signup", "/favicon.ico"]);

const PUBLIC_PREFIXES = [
  "/api/auth",
  "/_next",
  "/portal",
  "/emp-portal",
  "/api/portal-auth",
  "/api/emp-portal-auth",
  // Platform admin: its own session and its own login, outside office tenancy.
  "/admin",
  "/api/platform-auth",
] as const;

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
