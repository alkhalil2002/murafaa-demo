import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveAccess, type AccessState } from "@/lib/billing/lifecycle";
import type { PlatformSession } from "@/lib/auth/platform-session";

/**
 * Cross-tenant reads for the platform admin dashboard.
 *
 * THE RULE FOR THIS FILE: metadata only. Every query here selects office-level
 * counts and subscription state — never case titles, client names, document
 * contents, or anything else a firm's clients would recognise as their own
 * legal matter. Murafaa staff need to know that an office has 40 cases, not
 * what they are about. Widening any select below is a PDPL decision, not a
 * convenience.
 *
 * Nothing in here takes an AppSession, so no tenant principal can reach it.
 */

export type OfficeRow = {
  id: string;
  name: string;
  createdAt: Date;
  status: SubscriptionStatus | null;
  accessState: AccessState | null;
  daysRemaining: number;
  planName: string | null;
  priceHalalas: number;
  seats: number;
  cases: number;
};

export type PlatformOverview = {
  offices: OfficeRow[];
  totals: {
    offices: number;
    trialing: number;
    active: number;
    lapsed: number;
    /** Monthly recurring revenue in halalas, from ACTIVE subscriptions only. */
    mrrHalalas: number;
  };
};

/** Every office with its subscription state. Metadata only — see file note. */
export async function getPlatformOverview(_session: PlatformSession): Promise<PlatformOverview> {
  const offices = await prisma.office.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      subscription: {
        select: {
          status: true,
          trialEndsAt: true,
          currentPeriodEnd: true,
          plan: { select: { nameAr: true, priceHalalas: true } },
        },
      },
      _count: { select: { users: true, cases: true } },
    },
  });

  const now = new Date();
  const rows: OfficeRow[] = offices.map((o) => {
    const sub = o.subscription;
    const access = sub ? resolveAccess(sub, now) : null;
    return {
      id: o.id,
      name: o.name,
      createdAt: o.createdAt,
      status: sub?.status ?? null,
      accessState: access?.state ?? null,
      daysRemaining: access?.daysRemaining ?? 0,
      planName: sub?.plan?.nameAr ?? null,
      priceHalalas: sub?.plan?.priceHalalas ?? 0,
      seats: o._count.users,
      cases: o._count.cases,
    };
  });

  return {
    offices: rows,
    totals: {
      offices: rows.length,
      trialing: rows.filter((r) => r.accessState === "TRIAL").length,
      active: rows.filter((r) => r.accessState === "ACTIVE" && r.status === SubscriptionStatus.ACTIVE).length,
      lapsed: rows.filter((r) => r.accessState === "GRACE" || r.accessState === "READ_ONLY").length,
      // Only genuinely paying offices count toward MRR — a trial is not revenue.
      mrrHalalas: rows
        .filter((r) => r.status === SubscriptionStatus.ACTIVE)
        .reduce((sum, r) => sum + r.priceHalalas, 0),
    },
  };
}
