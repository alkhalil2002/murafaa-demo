export const SESSION_COOKIE = "murafaa_session";

/** Read one cookie from a Cookie header. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name)
      return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

/**
 * The session cookie: httpOnly (no JS access), SameSite=Lax (not sent on
 * cross-site POSTs), Secure outside local development.
 */
export function sessionCookie(
  token: string,
  maxAgeSeconds: number,
  secure: boolean,
  name: string = SESSION_COOKIE,
): string {
  return [
    `${name}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function clearedSessionCookie(secure: boolean, name: string = SESSION_COOKIE): string {
  return sessionCookie("", 0, secure, name);
}
