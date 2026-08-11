import { SubscriptionStatus } from "@prisma/client";

/**
 * Trial / grace / lock lifecycle.
 *
 * Pure functions over (stored status, dates, now) — no database, no clock of
 * their own — so every boundary is unit-testable and the whole thing is
 * deterministic.
 *
 * THE KEY DESIGN DECISION: access state is DERIVED at read time, never written
 * by a scheduler. A cron that flips TRIALING→LOCKED is a liability in a legal
 * product: if it fails to run, an expired office keeps working for free; if it
 * runs against a stale clock, a paying office is locked out of live case files.
 * Deriving from `trialEndsAt` makes both impossible — the answer is a function
 * of the data, and a missed job changes nothing.
 *
 * The stored `SubscriptionStatus` answers only "what does billing think?"
 * (trialing / paid / collection failed / cancelled). This module answers
 * "what may they do right now?".
 */

/** Free trial length, from registration. */
export const TRIAL_DAYS = 7;

/**
 * Days of continued FULL access after the trial (or a failed payment) before
 * the office drops to read-only. Chosen over a hard cut-off because a law
 * office losing write access mid-hearing over a billing lapse is a worse
 * failure than a few days of unpaid use.
 */
export const GRACE_DAYS = 3;

/** What the office may actually do right now. */
export type AccessState =
  /** Inside the free trial — full access. */
  | "TRIAL"
  /** Paid and current — full access. */
  | "ACTIVE"
  /** Trial or period has lapsed; still full access, show the warning banner. */
  | "GRACE"
  /** Lapsed past grace — reads allowed, every write blocked. */
  | "READ_ONLY";

export type SubscriptionLike = {
  status: SubscriptionStatus;
  trialEndsAt: Date;
  currentPeriodEnd: Date | null;
};

export type AccessDecision = {
  state: AccessState;
  /** True when every mutation must be refused. */
  writeLocked: boolean;
  /** Whole days until the next transition; 0 on the day it happens. */
  daysRemaining: number;
  /** The instant access changes; null when ACTIVE and nothing is pending. */
  changesAt: Date | null;
};

const DAY_MS = 86_400_000;

/**
 * Exact 24h-interval arithmetic — deliberately NOT `plusDays` from lib/dates.
 *
 * That helper snaps to Riyadh CALENDAR-day boundaries, which is right for a
 * legal deadline ("judgment + 30 calendar days") and wrong for a billing
 * clock: it would end a trial started at 09:00 Riyadh at 03:00 on day 7,
 * quietly shortchanging the customer by several hours and making
 * "7 days" untrue. A subscription clock runs from the instant of signup.
 */
function addDays(from: Date, n: number): Date {
  return new Date(from.getTime() + n * DAY_MS);
}

/** Whole days from `from` to `to`, rounded up; negative once `to` has passed. */
function daysUntil(to: Date, from: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

/** End of the grace window that follows `lapsedAt`. */
export function graceEnd(lapsedAt: Date): Date {
  return addDays(lapsedAt, GRACE_DAYS);
}

/** The trial end for an office registering at `at`. */
export function trialEndFor(at: Date): Date {
  return addDays(at, TRIAL_DAYS);
}

/**
 * Resolve what an office may do.
 *
 * CANCELED is read-only immediately — cancelling is a deliberate act, so there
 * is nothing to warn about — but the office keeps reading its own data
 * indefinitely. We never withhold a firm's case files.
 */
export function resolveAccess(sub: SubscriptionLike, now: Date): AccessDecision {
  if (sub.status === SubscriptionStatus.CANCELED) {
    return { state: "READ_ONLY", writeLocked: true, daysRemaining: 0, changesAt: null };
  }

  // The date the current entitlement lapsed (or will lapse).
  const lapse =
    sub.status === SubscriptionStatus.TRIALING
      ? sub.trialEndsAt
      : (sub.currentPeriodEnd ?? sub.trialEndsAt);

  // Paid and still inside the period — nothing pending.
  if (sub.status === SubscriptionStatus.ACTIVE && now < lapse) {
    return {
      state: "ACTIVE",
      writeLocked: false,
      daysRemaining: daysUntil(lapse, now),
      changesAt: lapse,
    };
  }

  // Still inside the trial.
  if (sub.status === SubscriptionStatus.TRIALING && now < lapse) {
    return {
      state: "TRIAL",
      writeLocked: false,
      daysRemaining: daysUntil(lapse, now),
      changesAt: lapse,
    };
  }

  // Lapsed — grace, then read-only. Covers PAST_DUE too: a failed charge gets
  // the same runway as an expiring trial.
  const graceUntil = graceEnd(lapse);
  if (now < graceUntil) {
    return {
      state: "GRACE",
      writeLocked: false,
      daysRemaining: daysUntil(graceUntil, now),
      changesAt: graceUntil,
    };
  }

  return { state: "READ_ONLY", writeLocked: true, daysRemaining: 0, changesAt: null };
}

/**
 * An office with no subscription row at all — only possible for data seeded
 * before this feature existed. Treated as fully entitled rather than locked:
 * a migration gap must never lock a real office out of its own files.
 */
export const UNRESTRICTED: AccessDecision = {
  state: "ACTIVE",
  writeLocked: false,
  daysRemaining: 0,
  changesAt: null,
};
