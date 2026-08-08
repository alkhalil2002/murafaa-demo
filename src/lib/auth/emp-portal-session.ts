import crypto from "node:crypto";
import { cookies } from "next/headers";

/**
 * Employee-portal session (بوابة الموظف). Mirrors portal-session.ts
 * (client portal) exactly, for the same reason: employees have no system
 * User/role by default (docs/04) — this is a small self-contained
 * HMAC-signed cookie, a distinct principal type from both staff and clients.
 */

export type EmpPortalSession = {
  employeeId: string;
  officeId: string;
  name: string;
  phone: string;
};

const COOKIE_NAME = "emp_portal_session";
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET not configured");
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(session: EmpPortalSession, expiresAt: number): string {
  const payload = Buffer.from(JSON.stringify({ ...session, exp: expiresAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): EmpPortalSession | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    if (!data.employeeId || !data.officeId || !data.phone) return null;
    return { employeeId: data.employeeId, officeId: data.officeId, name: data.name ?? "", phone: data.phone };
  } catch {
    return null;
  }
}

export async function createEmpPortalSession(session: EmpPortalSession): Promise<void> {
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

export async function getEmpPortalSession(): Promise<EmpPortalSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decode(token);
}

export async function requireEmpPortalSession(): Promise<EmpPortalSession> {
  const session = await getEmpPortalSession();
  if (!session) throw new Error("EMP_PORTAL_UNAUTHENTICATED");
  return session;
}

export async function destroyEmpPortalSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
