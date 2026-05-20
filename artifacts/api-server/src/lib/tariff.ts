// Lifetime-deposit tariff table for crypto on-ramps. Returns the platform
// commission rate as a fraction (0..1), the next-tier threshold (USDT cents),
// and any bonus flag awarded when the tier is reached.
//
// Tiers (lifetime USDT):
//   < 2,000     → 50%
//   < 15,000    → 35%
//   < 80,000    → 35%   + Free Premium 2y
//   < 250,000   → 25%   + hidden bonus (TBD)
//   ≥ 250,000   → 5%    + "investor" status
//
// Premium (when active) drops every rate that's ≥ 15% by 15 percentage points,
// i.e. 50→35, 35→20, 25→10. The minimum 5% tier is untouched.

export interface TariffTier {
  ratePct: number; // 0..100
  bonus: "none" | "free_premium_2y" | "hidden" | "investor";
  upperUsdtCents: number | null; // exclusive upper bound, null = top tier
}

export function tierForLifetimeCents(usdtCents: number): TariffTier {
  if (usdtCents < 200_000) {
    return { ratePct: 50, bonus: "none", upperUsdtCents: 200_000 };
  }
  if (usdtCents < 1_500_000) {
    return { ratePct: 35, bonus: "none", upperUsdtCents: 1_500_000 };
  }
  if (usdtCents < 8_000_000) {
    return {
      ratePct: 35,
      bonus: "free_premium_2y",
      upperUsdtCents: 8_000_000,
    };
  }
  if (usdtCents < 25_000_000) {
    return { ratePct: 25, bonus: "hidden", upperUsdtCents: 25_000_000 };
  }
  return { ratePct: 5, bonus: "investor", upperUsdtCents: null };
}

export interface ApplyTariffArgs {
  lifetimeUsdtCents: number;
  premiumActive: boolean;
}

export function effectiveDepositRatePct(args: ApplyTariffArgs): number {
  const tier = tierForLifetimeCents(args.lifetimeUsdtCents);
  let rate = tier.ratePct;
  if (args.premiumActive && rate >= 15) {
    rate = Math.max(0, rate - 15);
  }
  return rate;
}

// Free Premium 2y is awarded exactly once when the lifetime deposit crosses
// the $15k threshold. Caller compares prev vs. next lifetime totals.
export function premiumGrantOnCross(
  prevCents: number,
  nextCents: number,
): null | { freePremiumDays: number } {
  if (prevCents < 1_500_000 && nextCents >= 1_500_000) {
    return { freePremiumDays: 365 * 2 };
  }
  return null;
}

export function isPremiumActive(
  premiumUntil: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!premiumUntil) return false;
  const d = premiumUntil instanceof Date ? premiumUntil : new Date(premiumUntil);
  return d.getTime() > now.getTime();
}

// Generic helper for any platform fee that respects the same "−15pp when
// premium and rate ≥ 15%" rule.
export function applyPremiumDiscountPct(
  ratePct: number,
  premiumActive: boolean,
): number {
  if (!premiumActive) return ratePct;
  if (ratePct < 15) return ratePct;
  return Math.max(0, ratePct - 15);
}
