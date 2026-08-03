import { describe, it, expect } from "vitest";

/** Mirrors the SQL `GREATEST(COALESCE(premiumUntil, now), now) + days` extension. */
function extendPremiumUntil(
  currentUntil: Date | null,
  days: number,
  now: Date,
): Date {
  const base = currentUntil && currentUntil > now ? currentUntil : now;
  return new Date(base.getTime() + days * 24 * 3600 * 1000);
}

describe("premiumUntil extension (concurrent-safe stacking)", () => {
  const now = new Date("2026-08-03T12:00:00Z");

  it("extends from now when premium is inactive", () => {
    const first = extendPremiumUntil(null, 7, now);
    const second = extendPremiumUntil(first, 7, now);
    expect(second.getTime() - first.getTime()).toBe(7 * 24 * 3600 * 1000);
  });

  it("stacks on active premium instead of overwriting", () => {
    const activeUntil = new Date("2026-08-10T12:00:00Z");
    const extended = extendPremiumUntil(activeUntil, 7, now);
    expect(extended.toISOString()).toBe("2026-08-17T12:00:00.000Z");
  });
});
