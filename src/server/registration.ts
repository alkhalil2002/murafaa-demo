import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { normalizeSaudiPhone } from "@/lib/auth/phone";
import { ALL_MODULES, ALL_ROLES, SEED_CASE_SCOPE, SEED_FIELD_DENY, seedLevel } from "@/lib/permissions/matrix";
import { trialEndFor } from "@/lib/billing/lifecycle";
import { logSystemAudit } from "@/lib/audit";

/**
 * Self-serve office registration.
 *
 * Creates a whole tenant: the office, its first PARTNER user, the complete
 * permission matrix, and a TRIALING subscription — all in ONE transaction. A
 * partial tenant is worse than no tenant: an office without permission rows
 * denies everything (its own owner included), and an office without a
 * subscription row would silently get unlimited free access under the
 * "missing row = unrestricted" rule in lifecycle.ts.
 *
 * No payment details are collected — the trial starts on phone verification
 * alone.
 */

export const registrationSchema = z.object({
  officeName: z.string().trim().min(2).max(120),
  adminName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(1),
});

export type RegistrationInput = z.input<typeof registrationSchema>;

export type RegistrationResult =
  | { ok: true; officeId: string; userId: string; trialEndsAt: Date }
  | { ok: false; code: "PHONE_INVALID" | "PHONE_TAKEN" | "VALIDATION" };

/**
 * Is this phone already a staff login anywhere on the platform?
 *
 * Phone is the login identifier and `resolveUser` in otp.ts refuses to
 * authenticate a number that maps to more than one active user — so allowing a
 * duplicate here would create an account that can never sign in.
 */
export async function isPhoneAvailable(rawPhone: string): Promise<boolean> {
  const phone = normalizeSaudiPhone(rawPhone);
  if (!phone) return false;
  const existing = await prisma.user.findFirst({
    where: { phone, isActive: true, deletedAt: null },
    select: { id: true },
  });
  return existing === null;
}

export async function registerOffice(
  raw: RegistrationInput,
  now: Date = new Date(),
): Promise<RegistrationResult> {
  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "VALIDATION" };

  const phone = normalizeSaudiPhone(parsed.data.phone);
  if (!phone) return { ok: false, code: "PHONE_INVALID" };
  if (!(await isPhoneAvailable(phone))) return { ok: false, code: "PHONE_TAKEN" };

  const created = await prisma.$transaction(async (tx) => {
    const office = await tx.office.create({ data: { name: parsed.data.officeName } });

    // Full default matrix — identical to the seed's, so a self-serve office is
    // configured exactly like a seeded one.
    await tx.permission.createMany({
      data: ALL_ROLES.flatMap((role) =>
        ALL_MODULES.map((module) => ({
          officeId: office.id,
          role,
          module,
          level: seedLevel(role, module),
        })),
      ),
    });
    await tx.fieldPermission.createMany({
      data: SEED_FIELD_DENY.map((f) => ({ officeId: office.id, ...f })),
    });
    await tx.roleCaseScope.createMany({
      data: ALL_ROLES.map((role) => ({ officeId: office.id, role, scope: SEED_CASE_SCOPE[role] })),
    });

    const user = await tx.user.create({
      data: {
        officeId: office.id,
        name: parsed.data.adminName,
        phone,
        role: Role.PARTNER,
      },
    });

    const subscription = await tx.subscription.create({
      data: { officeId: office.id, trialEndsAt: trialEndFor(now) },
    });

    return { office, user, subscription };
  });

  await logSystemAudit(created.office.id, "office.register", `self-serve signup: ${created.office.name}`);

  return {
    ok: true,
    officeId: created.office.id,
    userId: created.user.id,
    trialEndsAt: created.subscription.trialEndsAt,
  };
}
