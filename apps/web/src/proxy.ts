import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "murafaa_session";
const PUBLIC_PATHS = ["/login", "/auth/expired"];

/** Each portal has its own cookie and login page; staff sessions never open them. */
const PORTALS = [
  { prefix: "/portal", cookie: "murafaa_portal", login: "/portal/login" },
  { prefix: "/emp-portal", cookie: "murafaa_emp_portal", login: "/emp-portal/login" },
  { prefix: "/platform", cookie: "murafaa_platform", login: "/platform/login" },
] as const;

/**
 * Navigation only (Next 16 proxy, formerly middleware): send signed-out
 * visitors to the right login page and signed-in ones away from it. It checks
 * only that a cookie exists; the API decides whether the session is valid.
 */
/** Platform activation links work before any session exists. */
const OPEN_PATHS = ["/platform/activate"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (OPEN_PATHS.includes(pathname)) return NextResponse.next();
  const portal = PORTALS.find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`));
  if (portal) {
    const signedIn = request.cookies.has(portal.cookie);
    if (!signedIn && pathname !== portal.login)
      return NextResponse.redirect(new URL(portal.login, request.url));
    if (signedIn && pathname === portal.login)
      return NextResponse.redirect(new URL(portal.prefix, request.url));
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
  if (!hasSession && !isPublic) return NextResponse.redirect(new URL("/login", request.url));
  if (hasSession && pathname === "/login")
    return NextResponse.redirect(new URL("/today", request.url));
  return NextResponse.next();
}

export const config = {
  // /api is rewritten straight to the API, which checks the session itself.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
