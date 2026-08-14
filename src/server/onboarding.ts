import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { AppSession } from "@/lib/auth/types";
import { effectiveRole } from "@/lib/permissions/engine";
import { normalizeSaudiPhone } from "@/lib/auth/phone";
import { updateOfficeTerms } from "./terms";

/**
 * First-run setup for a newly registered office (docs/05 — signup lands on an
 * empty product otherwise).
 *
 * The wizard is a guide, not a gate. Every step is skippable and the office is
 * fully usable without finishing: an owner who wants to get straight to a case
 * should not have to argue with a form first. What it must not do is silently
 * lose progress, so the furthest step reached is persisted per office and the
 * wizard resumes there.
 */

/** Ordered wizard steps. The array index IS the persisted `onboardingStep`. */
export const ONBOARDING_STEPS = ["intro", "identity", "terms", "team", "done"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export const LAST_STEP_INDEX = ONBOARDING_STEPS.length - 1;

export type OnboardingProgress = {
  /** Index into ONBOARDING_STEPS, always within bounds. */
  step: number;
  done: boolean;
  officeName: string;
  /** Whether the office has any colleague besides the owner yet. */
  teamCount: number;
};

/**
 * Only a PARTNER configures an office. An ASSISTANT who happens to log in first
 * must not be walked through branding and terminology.
 */
export function mayRunOnboarding(session: AppSession): boolean {
  return effectiveRole(session) === Role.PARTNER;
}

export async function getProgress(session: AppSession): Promise<OnboardingProgress> {
  const [office, teamCount] = await Promise.all([
    prisma.office.findUniqueOrThrow({
      where: { id: session.officeId },
      select: { name: true, onboardingStep: true, onboardingDoneAt: true },
    }),
    prisma.user.count({ where: { officeId: session.officeId, deletedAt: null } }),
  ]);

  return {
    // Clamped: the column is an unconstrained Int, and a stale value left by a
    // shortened wizard would otherwise index past the end of the array.
    step: Math.min(Math.max(office.onboardingStep, 0), LAST_STEP_INDEX),
    done: office.onboardingDoneAt !== null,
    officeName: office.name,
    teamCount,
  };
}

/**
 * Record forward progress. Monotonic on purpose — stepping back to review an
 * earlier screen must not make the office look less set up than it is, or a
 * later resume would drop the user behind where they actually got to.
 */
export async function advanceTo(session: AppSession, step: number): Promise<void> {
  if (!mayRunOnboarding(session)) throw new Error("PARTNER_ONLY");
  const target = Math.min(Math.max(step, 0), LAST_STEP_INDEX);
  // One conditional statement rather than read-then-write: the owner may have
  // the wizard open in two tabs, and a check followed by a separate update
  // could let the slower tab write back a lower step.
  await prisma.office.updateMany({
    where: { id: session.officeId, onboardingStep: { lt: target } },
    data: { onboardingStep: target },
  });
}

/** Finish or skip. Either way the wizard stops owning the landing page. */
export async function completeOnboarding(session: AppSession): Promise<void> {
  if (!mayRunOnboarding(session)) throw new Error("PARTNER_ONLY");
  await prisma.office.update({
    where: { id: session.officeId },
    data: { onboardingDoneAt: new Date(), onboardingStep: LAST_STEP_INDEX },
  });
  await logAudit({
    session,
    action: "office.onboarding.complete",
    resource: "offices",
    targetId: session.officeId,
  });
}

/** Re-open the wizard from settings. */
export async function reopenOnboarding(session: AppSession): Promise<void> {
  if (!mayRunOnboarding(session)) throw new Error("PARTNER_ONLY");
  await prisma.office.update({
    where: { id: session.officeId },
    data: { onboardingDoneAt: null, onboardingStep: 0 },
  });
}

export { updateOfficeTerms };

const identitySchema = z.object({
  name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(160).optional().default(""),
});

/** Step "identity" — just the name and tagline; full branding lives in settings. */
export async function saveIdentity(
  session: AppSession,
  raw: z.input<typeof identitySchema>,
): Promise<void> {
  if (!mayRunOnboarding(session)) throw new Error("PARTNER_ONLY");
  const input = identitySchema.parse(raw);
  const office = await prisma.office.findUniqueOrThrow({
    where: { id: session.officeId },
    select: { branding: true },
  });
  const existing =
    office.branding && typeof office.branding === "object" && !Array.isArray(office.branding)
      ? (office.branding as Record<string, unknown>)
      : {};
  await prisma.office.update({
    where: { id: session.officeId },
    data: {
      name: input.name,
      branding: { ...existing, name: input.name, tagline: input.tagline },
    },
  });
  await logAudit({
    session,
    action: "office.identity.update",
    resource: "offices",
    targetId: session.officeId,
  });
}

const inviteSchema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(1),
  role: z.nativeEnum(Role),
});
export type InviteResult =
  | { ok: true; userId: string }
  | { ok: false; code: "VALIDATION" | "PHONE_INVALID" | "PHONE_TAKEN" | "PARTNER_ONLY" };

/**
 * Step "team" — add a colleague.
 *
 * No password or invitation email: the phone IS the identity, so the new user
 * signs in with an OTP to that number exactly like the owner did. Their
 * permissions come from the role matrix the office already has.
 */
export async function inviteTeamMember(
  session: AppSession,
  raw: z.input<typeof inviteSchema>,
): Promise<InviteResult> {
  if (!mayRunOnboarding(session)) return { ok: false, code: "PARTNER_ONLY" };
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "VALIDATION" };

  const phone = normalizeSaudiPhone(parsed.data.phone);
  if (!phone) return { ok: false, code: "PHONE_INVALID" };

  // Global, not office-scoped: sendOtp resolves a phone to exactly one active
  // user across all offices and refuses when it is ambiguous. A duplicate here
  // would lock BOTH people out rather than just colliding locally.
  const taken = await prisma.user.findFirst({
    where: { phone, deletedAt: null },
    select: { id: true },
  });
  if (taken) return { ok: false, code: "PHONE_TAKEN" };

  const user = await prisma.user.create({
    data: {
      officeId: session.officeId,
      name: parsed.data.name,
      phone,
      role: parsed.data.role,
    },
    select: { id: true },
  });
  await logAudit({
    session,
    action: "office.user.invite",
    resource: "offices",
    targetId: user.id,
  });
  return { ok: true, userId: user.id };
}
