import crypto from "node:crypto";
import { cookies } from "next/headers";

/**
 * Platform-admin session (Murafaa staff).
 *
 * A third, fully separate principal type alongside staff (Auth.js) and the two
 * portals. Deliberately carries NO officeId: a platform admin is not a member
 * of any tenant, and giving this session an office field would make it possible
 * to mistake one for a staff session somewhere downstream.
 *
 * Same HMAC-signed-cookie primitive as the portal sessions, with its own cookie
 * name and its own signing salt, so a token minted for one principal type can
 * never validate as another.
 */

export type PlatformSession = {
  adminId: string;
  name: string;
  phone: string;
};

const COOKIE_NAME = "platform_session";
/** Short by design — this session can read every tenant's metadata. */
const TTL_SECONDS = 60 * 60 * 8;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET not configured");
  return s;
}

/** Salted with "platform:" so a portal/staff token can never validate here. */
function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(`platform:${payload}`).digest("base64url");
}

function encode(session: PlatformSession, expiresAt: number): string {
  const payload = Buffer.from(JSON.stringify({ ...session, exp: expiresAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): PlatformSession | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const a = Buffer.from(signature);
  const b = Buffer.from(sign(payload));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    if (!data.adminId || !data.phone) return null;
    return { adminId: data.adminId, name: data.name ?? "", phone: data.phone };
  } catch {
    return null;
  }
}

export async function createPlatformSession(session: PlatformSession): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, encode(session, Date.now() + TTL_SECONDS * 1000), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function getPlatformSession(): Promise<PlatformSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decode(token);
}

export async function destroyPlatformSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
