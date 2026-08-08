import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AppSession } from "@/lib/auth/types";

/**
 * الباقات (docs/05) — Murafaa's own subscription plans/payment methods have
 * no real backing here (no payment gateway is wired into this project), so
 * fabricating plan tiers or a checkout UI would violate the no-mock-data
 * rule. What IS real: how much of the office is actually using the system —
 * shown as a plain usage summary instead.
 */

export type BillingUsage = {
  seats: number;
  cases: number;
  clients: number;
  documents: number;
  memberSince: Date;
};

export async function getBillingUsage(session: AppSession): Promise<BillingUsage> {
  if (session.role !== Role.PARTNER) throw new Error("PARTNER_ONLY");
  const [seats, cases, clients, documents, office] = await Promise.all([
    prisma.user.count({ where: { officeId: session.officeId, isActive: true } }),
    prisma.case.count({ where: { officeId: session.officeId, deletedAt: null } }),
    prisma.client.count({ where: { officeId: session.officeId, deletedAt: null } }),
    prisma.document.count({ where: { officeId: session.officeId, deletedAt: null } }),
    prisma.office.findUniqueOrThrow({ where: { id: session.officeId }, select: { createdAt: true } }),
  ]);
  return { seats, cases, clients, documents, memberSince: office.createdAt };
}
