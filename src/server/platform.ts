import { SubscriptionStatus } from "@prisma/client";
import { z } from "zod";
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

/* ── Plan management ──────────────────────────────────────────────────────
 * Plans are platform-owned catalogue rows, not tenant data, so they sit here
 * rather than behind an office session.
 */

export type PlanRow = {
  id: string;
  code: string;
  nameAr: string;
  priceHalalas: number;
  seatLimit: number | null;
  isActive: boolean;
  sortOrder: number;
  /** Subscriptions pointing at this plan. Non-zero means it cannot be deleted. */
  subscriberCount: number;
};

export async function listPlans(_session: PlatformSession): Promise<PlanRow[]> {
  const plans = await prisma.plan.findMany({
    orderBy: [{ sortOrder: "asc" }, { priceHalalas: "asc" }],
    select: {
      id: true,
      code: true,
      nameAr: true,
      priceHalalas: true,
      seatLimit: true,
      isActive: true,
      sortOrder: true,
      _count: { select: { subscriptions: true } },
    },
  });
  return plans.map(({ _count, ...p }) => ({ ...p, subscriberCount: _count.subscriptions }));
}

const planSchema = z.object({
  // Machine code: referenced by config and tests, so it is constrained rather
  // than free text, and never editable after creation.
  code: z.string().trim().regex(/^[a-z0-9_]{2,32}$/, "CODE_INVALID"),
  nameAr: z.string().trim().min(1).max(80),
  /** Whole riyals in, halalas stored — money is never a float (docs guardrail 4). */
  priceRiyals: z.number().int().min(0).max(1_000_000),
  seatLimit: z.number().int().min(1).max(10_000).nullable(),
  sortOrder: z.number().int().min(0).max(999).default(0),
});
export type CreatePlanInput = z.input<typeof planSchema>;

export type PlanResult =
  | { ok: true; id: string }
  | { ok: false; code: "VALIDATION" | "CODE_TAKEN" };

export async function createPlan(
  _session: PlatformSession,
  raw: CreatePlanInput,
): Promise<PlanResult> {
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: "VALIDATION" };
  const input = parsed.data;

  const clash = await prisma.plan.findUnique({ where: { code: input.code }, select: { id: true } });
  if (clash) return { ok: false, code: "CODE_TAKEN" };

  const plan = await prisma.plan.create({
    data: {
      code: input.code,
      nameAr: input.nameAr,
      priceHalalas: input.priceRiyals * 100,
      seatLimit: input.seatLimit,
      sortOrder: input.sortOrder,
    },
    select: { id: true },
  });
  return { ok: true, id: plan.id };
}

export type DeletePlanResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "IN_USE"; subscriberCount?: number };

/**
 * Delete a plan — only while nothing is subscribed to it.
 *
 * A plan an office is paying on is not a catalogue entry any more; it is the
 * terms of a live agreement, and the subscription's FK depends on it. Deleting
 * it would either fail at the database or, worse, orphan the billing record
 * that says what that office agreed to pay.
 *
 * Retiring a plan that IS in use is a different operation: `setPlanActive`
 * hides it from new signups while every existing subscriber keeps their terms.
 * The caller is told which of the two it needs rather than being given a
 * "delete" that silently does something else.
 */
export async function deletePlan(_session: PlatformSession, id: string): Promise<DeletePlanResult> {
  const plan = await prisma.plan.findUnique({
    where: { id },
    select: { id: true, _count: { select: { subscriptions: true } } },
  });
  if (!plan) return { ok: false, code: "NOT_FOUND" };
  if (plan._count.subscriptions > 0) {
    return { ok: false, code: "IN_USE", subscriberCount: plan._count.subscriptions };
  }
  await prisma.plan.delete({ where: { id } });
  return { ok: true };
}

/** Retire or restore a plan. Existing subscribers are untouched either way. */
export async function setPlanActive(
  _session: PlatformSession,
  id: string,
  isActive: boolean,
): Promise<void> {
  await prisma.plan.updateMany({ where: { id }, data: { isActive } });
}
