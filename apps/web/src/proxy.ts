import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "murafaa_session";
const PUBLIC_PATHS = ["/login", "/auth/expired"];

/**
 * Navigation only (Next 16 proxy, formerly middleware): send signed-out
 * visitors to /login and signed-in ones away from it. It checks only that a
 * cookie exists; the API decides whether the session is valid.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
