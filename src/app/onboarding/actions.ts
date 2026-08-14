"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth/session";
import {
  advanceTo,
  completeOnboarding,
  inviteTeamMember,
  saveIdentity,
  updateOfficeTerms,
} from "@/server/onboarding";
import { GLOSSARY } from "@/lib/i18n/glossary";

/**
 * Server actions for the first-run wizard.
 *
 * Each returns plain state rather than redirecting, so a failed step re-renders
 * with its message and the owner does not lose what they typed.
 */

export type StepState = { ok?: true; error?: string };

async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function saveIdentityAction(_prev: StepState, form: FormData): Promise<StepState> {
  const session = await requireSession();
  try {
    await saveIdentity(session, {
      name: String(form.get("name") ?? ""),
      tagline: String(form.get("tagline") ?? ""),
    });
    await advanceTo(session, 2);
    revalidatePath("/onboarding");
    return { ok: true };
  } catch {
    return { error: "VALIDATION" };
  }
}

export async function saveTermsAction(_prev: StepState, form: FormData): Promise<StepState> {
  const session = await requireSession();
  try {
    // Read only known glossary ids; a form field we do not recognise is not
    // forwarded to the sanitizer at all.
    const overrides: Record<string, unknown> = {};
    for (const def of GLOSSARY) {
      const value = form.get(`term.${def.id}`);
      if (typeof value === "string") overrides[def.id] = value;
    }
    await updateOfficeTerms(session, overrides);
    await advanceTo(session, 3);
    revalidatePath("/", "layout"); // nav labels change everywhere
    return { ok: true };
  } catch {
    return { error: "VALIDATION" };
  }
}

export async function inviteAction(_prev: StepState, form: FormData): Promise<StepState> {
  const session = await requireSession();
  const roleRaw = String(form.get("role") ?? "");
  const role = (Object.values(Role) as string[]).includes(roleRaw) ? (roleRaw as Role) : Role.LAWYER;

  const result = await inviteTeamMember(session, {
    name: String(form.get("name") ?? ""),
    phone: String(form.get("phone") ?? ""),
    role,
  });
  if (!result.ok) return { error: result.code };
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function advanceAction(step: number): Promise<void> {
  const session = await requireSession();
  await advanceTo(session, step);
  revalidatePath("/onboarding");
}

export async function finishAction(): Promise<void> {
  const session = await requireSession();
  await completeOnboarding(session);
  revalidatePath("/", "layout");
}

// NOTE: a "use server" module may export ONLY async functions — every export
// becomes a callable server endpoint. Re-exporting a constant from here is a
// build error, so importers take LAST_STEP_INDEX from @/server/onboarding.
