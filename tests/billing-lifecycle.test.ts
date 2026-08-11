import { describe, expect, it } from "vitest";
import { SubscriptionStatus } from "@prisma/client";
import {
  GRACE_DAYS,
  TRIAL_DAYS,
  UNRESTRICTED,
  resolveAccess,
  trialEndFor,
  graceEnd,
} from "@/lib/billing/lifecycle";

/**
 * The trial → grace → read-only boundaries. These decide whether a paying law
 * office can write to its own case files, so every edge is pinned explicitly
 * rather than inferred.
 */

const REGISTERED = new Date("2026-03-01T09:00:00.000Z");
const at = (iso: string) => new Date(iso);

const trialing = {
  status: SubscriptionStatus.TRIALING,
  trialEndsAt: trialEndFor(REGISTERED),
  currentPeriodEnd: null,
};

describe("trial length", () => {
  it("runs for exactly TRIAL_DAYS from registration", () => {
    expect(TRIAL_DAYS).toBe(7);
    expect(trialEndFor(REGISTERED).toISOString()).toBe("2026-03-08T09:00:00.000Z");
  });

  it("grace runs GRACE_DAYS past the lapse", () => {
    expect(GRACE_DAYS).toBe(3);
    expect(graceEnd(trialEndFor(REGISTERED)).toISOString()).toBe("2026-03-11T09:00:00.000Z");
  });
});

describe("resolveAccess — trial", () => {
  it("is TRIAL on day 0 with the full window remaining", () => {
    const d = resolveAccess(trialing, REGISTERED);
    expect(d.state).toBe("TRIAL");
    expect(d.writeLocked).toBe(false);
    expect(d.daysRemaining).toBe(7);
  });

  it("is still TRIAL one second before expiry", () => {
    const d = resolveAccess(trialing, at("2026-03-08T08:59:59.000Z"));
    expect(d.state).toBe("TRIAL");
    expect(d.writeLocked).toBe(false);
  });

  it("flips to GRACE exactly at expiry, still writable", () => {
    const d = resolveAccess(trialing, at("2026-03-08T09:00:00.000Z"));
    expect(d.state).toBe("GRACE");
    expect(d.writeLocked).toBe(false);
    expect(d.daysRemaining).toBe(3);
  });
});

describe("resolveAccess — grace then lock", () => {
  it("stays writable through the grace window", () => {
    for (const iso of ["2026-03-08T12:00:00.000Z", "2026-03-10T23:00:00.000Z"]) {
      const d = resolveAccess(trialing, at(iso));
      expect(d.state).toBe("GRACE");
      expect(d.writeLocked).toBe(false);
    }
  });

  it("is still GRACE one second before grace ends", () => {
    expect(resolveAccess(trialing, at("2026-03-11T08:59:59.000Z")).state).toBe("GRACE");
  });

  it("locks writes exactly when grace ends", () => {
    const d = resolveAccess(trialing, at("2026-03-11T09:00:00.000Z"));
    expect(d.state).toBe("READ_ONLY");
    expect(d.writeLocked).toBe(true);
  });

  it("stays locked long after", () => {
    expect(resolveAccess(trialing, at("2027-01-01T00:00:00.000Z")).writeLocked).toBe(true);
  });
});

describe("resolveAccess — paid", () => {
  const active = {
    status: SubscriptionStatus.ACTIVE,
    trialEndsAt: trialEndFor(REGISTERED),
    currentPeriodEnd: at("2026-04-08T09:00:00.000Z"),
  };

  it("is ACTIVE inside the paid period, even long past the trial end", () => {
    const d = resolveAccess(active, at("2026-04-01T00:00:00.000Z"));
    expect(d.state).toBe("ACTIVE");
    expect(d.writeLocked).toBe(false);
  });

  it("gets the same grace runway when the period lapses", () => {
    expect(resolveAccess(active, at("2026-04-09T00:00:00.000Z")).state).toBe("GRACE");
    expect(resolveAccess(active, at("2026-04-12T00:00:00.000Z")).writeLocked).toBe(true);
  });
});

describe("resolveAccess — failed collection and cancellation", () => {
  it("PAST_DUE gets grace, not an instant lock", () => {
    const pastDue = {
      status: SubscriptionStatus.PAST_DUE,
      trialEndsAt: trialEndFor(REGISTERED),
      currentPeriodEnd: at("2026-05-01T09:00:00.000Z"),
    };
    expect(resolveAccess(pastDue, at("2026-05-02T09:00:00.000Z")).state).toBe("GRACE");
    expect(resolveAccess(pastDue, at("2026-05-05T09:00:00.000Z")).writeLocked).toBe(true);
  });

  it("CANCELED is read-only immediately — no grace, but reads still allowed", () => {
    const canceled = {
      status: SubscriptionStatus.CANCELED,
      trialEndsAt: trialEndFor(REGISTERED),
      currentPeriodEnd: at("2099-01-01T00:00:00.000Z"),
    };
    const d = resolveAccess(canceled, REGISTERED);
    expect(d.state).toBe("READ_ONLY");
    expect(d.writeLocked).toBe(true);
  });
});

describe("missing subscription", () => {
  it("is unrestricted, so a migration gap never locks a real office out", () => {
    expect(UNRESTRICTED.writeLocked).toBe(false);
  });
});
