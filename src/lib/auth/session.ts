import { Role } from "@prisma/client";
import { auth } from "./index";
import type { AppSession } from "./types";
import { getRolePreviewCookie } from "./role-preview";

/**
 * Resolve the current request's session as an AppSession, or null when
 * unauthenticated. Service/API code should call this and reject null before
 * doing anything else (docs/02 §5 — permission check comes first).
 */
export async function getSession(): Promise<AppSession | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || !u.officeId || !u.role) return null;
  // Only a real PARTNER may activate a role preview — a tampered cookie on
  // any other role is simply ignored (see role-preview.ts).
  const previewRole = u.role === Role.PARTNER ? await getRolePreviewCookie() : null;
  return {
    userId: u.id,
    officeId: u.officeId,
    name: u.name ?? "",
    phone: u.phone,
    role: u.role,
    previewRole,
  };
}

/** Like getSession but throws when unauthenticated — for guarded handlers. */
export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}
