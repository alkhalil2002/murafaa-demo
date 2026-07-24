import { auth } from "./index";
import type { AppSession } from "./types";

/**
 * Resolve the current request's session as an AppSession, or null when
 * unauthenticated. Service/API code should call this and reject null before
 * doing anything else (docs/02 §5 — permission check comes first).
 */
export async function getSession(): Promise<AppSession | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || !u.officeId || !u.role) return null;
  return {
    userId: u.id,
    officeId: u.officeId,
    name: u.name ?? "",
    phone: u.phone,
    role: u.role,
  };
}

/** Like getSession but throws when unauthenticated — for guarded handlers. */
export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}
