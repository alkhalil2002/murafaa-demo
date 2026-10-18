import { NextResponse } from "next/server";

/**
 * The API no longer accepts the session (expired, idle, revoked): drop the
 * cookie and go to the login page. Without this, /login would bounce a stale
 * cookie straight back to /today.
 */
export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete("murafaa_session");
  return response;
}
