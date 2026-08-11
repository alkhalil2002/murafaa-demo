import { cache as reactCache } from "react";
import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  UNRESTRICTED,
  resolveAccess,
  trialEndFor,
  type AccessDecision,
} from "@/lib/billing/lifecycle";

/**
 * Subscription reads for the tenant side of the app.
 *
 * `getAccess` is called on every write via the permission guard, so it is
 * request-memoised: a single server render performs one query no matter how
 * many guards run. The cache is per-request (a fresh module scope per server
 * request in Next's runtime), never process-wide — a stale entitlement must
 * never outlive the request that read it.
 */

/**
 * Entitlement for an office, memoised FOR ONE REQUEST.
 *
 * React's `cache()` is the right primitive here and a plain module-level Map is
 * not: module scope in the Next server is per-PROCESS, so a Map would serve the
 * first request's decision to every later request in that process — an office
 * whose trial lapsed would keep writing until the process restarted, and a
 * subscriber who just paid would stay locked. `cache()` is scoped to the
 * render/action pass and discarded with it.
 *
 * `now` is read inside, not taken as a parameter: a `Date` argument would be a
 * new object on every call and defeat the memoisation entirely.
 */
const loadAccess = reactCache(async (officeId: string): Promise<AccessDecision> => {
  const sub = await prisma.subscription.findUnique({
    where: { officeId },
    select: { status: true, trialEndsAt: true, currentPeriodEnd: true },
  });
  // Offices that predate this feature have no row. Treated as entitled — a
  // migration gap must never lock a real firm out of its own case files.
  if (!sub) return UNRESTRICTED;
  return resolveAccess(sub, new Date());
});

export function getAccess(officeId: string): Promise<AccessDecision> {
  return loadAccess(officeId);
}

/** Full subscription record for the billing screen. */
export async function getSubscription(officeId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { officeId },
    include: { plan: true },
  });
  if (!sub) return null;
  return { ...sub, access: resolveAccess(sub, new Date()) };
}

/** Plans on sale, cheapest first. */
export function listActivePlans() {
  return prisma.plan.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { priceHalalas: "asc" }],
  });
}

/**
 * Start an office's free trial. Called only from registration, inside the same
 * transaction that creates the office — an office must never exist without a
 * subscription row.
 */
export function createTrialSubscription(
  tx: { subscription: { create: typeof prisma.subscription.create } },
  officeId: string,
  now: Date = new Date(),
) {
  return tx.subscription.create({
    data: {
      officeId,
      status: SubscriptionStatus.TRIALING,
      trialEndsAt: trialEndFor(now),
    },
  });
}
