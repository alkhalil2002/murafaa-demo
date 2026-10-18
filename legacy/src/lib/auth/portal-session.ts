import crypto from "node:crypto";
import { cookies } from "next/headers";

/**
 * Client-portal session (بوابة العميل). Deliberately NOT built on the staff
 * Auth.js instance: that instance's Session/User types are globally augmented
 * with a staff `role: Role` (src/types/next-auth.d.ts) that has no meaning
 * for a client identity, and reusing it risks a portal principal ever being
 * mistaken for a staff one. Instead this is a small self-contained
 * HMAC-signed cookie — same primitive (crypto.createHmac + timingSafeEqual)
 * already used for OTP codes (src/lib/auth/otp.ts), just applied to a session
 * token instead of a 6-digit code.
 */

export type PortalSession = {
  clientId: string;
  officeId: string;
  name: string;
  phone: string;
};

const COOKIE_NAME = "portal_session";
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET not configured");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(session: PortalSession, expiresAt: number): string {
  const payload = Buffer.from(JSON.stringify({ ...session, exp: expiresAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): PortalSession | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    if (!data.clientId || !data.officeId || !data.phone) return null;
    return { clientId: data.clientId, officeId: data.officeId, name: data.name ?? "", phone: data.phone };
  } catch {
    return null;
  }
}

export async function createPortalSession(session: PortalSession): Promise<void> {
  const expiresAt = Date.now() + TTL_SECONDS * 1000;
  const store = await cookies();
  store.set(COOKIE_NAME, encode(session, expiresAt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decode(token);
}

export async function requirePortalSession(): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) throw new Error("PORTAL_UNAUTHENTICATED");
  return session;
}

export async function destroyPortalSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
