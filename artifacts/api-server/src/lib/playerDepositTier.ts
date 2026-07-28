// Player deposit tiers (bronze / silver / gold) — driven by lifetime USDT deposits.
// Hosts may apply per-tier price multipliers on top of the base per-minute rate.

export type PlayerDepositTier = "bronze" | "silver" | "gold";

/** Exclusive upper bounds in USDT cents (1¢ = 0.01 USDT). */
export const PLAYER_TIER_SILVER_MIN_CENTS = 2_000; // $20
export const PLAYER_TIER_GOLD_MIN_CENTS = 15_000; // $150

export function playerDepositTierForLifetimeCents(
  usdtCents: number,
): PlayerDepositTier {
  if (usdtCents >= PLAYER_TIER_GOLD_MIN_CENTS) return "gold";
  if (usdtCents >= PLAYER_TIER_SILVER_MIN_CENTS) return "silver";
  return "bronze";
}

export const PLAYER_TIER_LABELS: Record<PlayerDepositTier, string> = {
  bronze: "Бронза",
  silver: "Серебро",
  gold: "Золото",
};

export type HostTierMultipliers = {
  tierBronzeMultiplierPct: number;
  tierSilverMultiplierPct: number;
  tierGoldMultiplierPct: number;
};

export function tierMultiplierPct(
  host: HostTierMultipliers,
  tier: PlayerDepositTier,
): number {
  switch (tier) {
    case "bronze":
      return host.tierBronzeMultiplierPct;
    case "silver":
      return host.tierSilverMultiplierPct;
    case "gold":
      return host.tierGoldMultiplierPct;
  }
}

/** Apply host tier multiplier (100 = 1.0×). Result is rounded integer LZT. */
export function applyTierMultiplierLzt(
  baseLzt: number,
  multiplierPct: number,
): number {
  return Math.round(baseLzt * multiplierPct / 100);
}

export function effectivePricePerMinuteLzt(
  baseLzt: number,
  host: HostTierMultipliers,
  playerLifetimeUsdtCents: number,
): number {
  const tier = playerDepositTierForLifetimeCents(playerLifetimeUsdtCents);
  return applyTierMultiplierLzt(baseLzt, tierMultiplierPct(host, tier));
}

export function effectiveRatePerMinuteUsd(
  baseRateUsd: number,
  host: HostTierMultipliers,
  playerLifetimeUsdtCents: number,
): number {
  const baseLzt = Math.round(baseRateUsd * 200);
  const effectiveLzt = effectivePricePerMinuteLzt(
    baseLzt,
    host,
    playerLifetimeUsdtCents,
  );
  return effectiveLzt / 200;
}
