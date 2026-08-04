import { describe, expect, it } from "vitest";
import {
  applyPremiumDiscountPct,
  effectiveDepositRatePct,
  isPremiumActive,
  premiumGrantOnCross,
  tierForLifetimeCents,
} from "./tariff";

describe("tariff", () => {
  it("maps lifetime deposit tiers", () => {
    expect(tierForLifetimeCents(100_000).ratePct).toBe(50);
    expect(tierForLifetimeCents(1_499_999).ratePct).toBe(35);
    expect(tierForLifetimeCents(25_000_000).bonus).toBe("investor");
  });

  it("applies premium discount and crossing grants", () => {
    expect(
      effectiveDepositRatePct({ lifetimeUsdtCents: 100_000, premiumActive: true }),
    ).toBe(35);
    expect(applyPremiumDiscountPct(50, true)).toBe(35);
    expect(premiumGrantOnCross(1_400_000, 1_600_000)).toEqual({
      freePremiumDays: 365 * 2,
    });
    expect(isPremiumActive(new Date(Date.now() + 60_000))).toBe(true);
    expect(isPremiumActive(null)).toBe(false);
  });
});
