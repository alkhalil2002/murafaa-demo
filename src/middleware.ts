import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

// Edge-safe auth instance: uses only authConfig (no Credentials provider, no
// node:crypto/Prisma), so middleware can run on the Edge runtime.
const { auth } = NextAuth(authConfig);

/**
 * Route protection. Unauthenticated users are redirected to /login for any
 * app route. This is a convenience gate only — real authorization is enforced
 * server-side in the service layer (docs/04). The UI/route layer only hides.
 */
export default auth((req) => {
  const isLoggedIn = !!req.auth?.user?.id;
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (!isLoggedIn && !isPublic) {
    const url = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(url);
  }

  if (isLoggedIn && pathname === "/login") {
    return NextResponse.redirect(new URL("/today", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
