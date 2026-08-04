import { describe, expect, it } from "vitest";
import {
  applyPremiumDiscountPct,
  effectiveDepositRatePct,
  isPremiumActive,
  premiumGrantOnCross,
  tierForLifetimeCents,
} from "./tariff";

describe("tariff / premium", () => {
  it("maps lifetime deposit tiers", () => {
    expect(tierForLifetimeCents(0).ratePct).toBe(50);
    expect(tierForLifetimeCents(200_000).ratePct).toBe(35);
    expect(tierForLifetimeCents(25_000_000).bonus).toBe("investor");
  });

  it("applies premium −15pp when rate ≥ 15%", () => {
    expect(effectiveDepositRatePct({ lifetimeUsdtCents: 0, premiumActive: true })).toBe(35);
    expect(applyPremiumDiscountPct(5, true)).toBe(5);
    expect(applyPremiumDiscountPct(25, true)).toBe(10);
  });

  it("grants free premium once when crossing $15k", () => {
    expect(premiumGrantOnCross(1_499_999, 1_500_000)?.freePremiumDays).toBe(730);
    expect(premiumGrantOnCross(1_500_000, 2_000_000)).toBeNull();
  });

  it("detects active premium window", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(isPremiumActive(new Date("2026-06-01T00:00:00Z"), now)).toBe(true);
    expect(isPremiumActive(new Date("2025-12-01T00:00:00Z"), now)).toBe(false);
    expect(isPremiumActive(null, now)).toBe(false);
  });
});
