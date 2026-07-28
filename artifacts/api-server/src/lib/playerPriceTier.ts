// Player gaming tiers (bronze / silver / gold) — distinct from host hardware
// tiering in hostTier.ts. Drives per-host price multipliers set by the host.

export type PlayerGamingTier = "bronze" | "silver" | "gold";

/** Lifetime deposit thresholds in USDT cents (1¢ = 0.01 USDT). */
export const PLAYER_TIER_SILVER_MIN_CENTS = 2_000; // $20
export const PLAYER_TIER_GOLD_MIN_CENTS = 20_000; // $200

export const TIER_MULTIPLIER_MIN_PCT = 50;
export const TIER_MULTIPLIER_MAX_PCT = 200;

export interface HostTierMultipliers {
  bronze: number;
  silver: number;
  gold: number;
}

export function playerGamingTierFromLifetimeCents(
  lifetimeUsdtCents: number,
): PlayerGamingTier {
  if (lifetimeUsdtCents >= PLAYER_TIER_GOLD_MIN_CENTS) return "gold";
  if (lifetimeUsdtCents >= PLAYER_TIER_SILVER_MIN_CENTS) return "silver";
  return "bronze";
}

export function hostTierMultipliersFromHost(host: {
  tierBronzeMultiplierPct: number;
  tierSilverMultiplierPct: number;
  tierGoldMultiplierPct: number;
}): HostTierMultipliers {
  return {
    bronze: host.tierBronzeMultiplierPct,
    silver: host.tierSilverMultiplierPct,
    gold: host.tierGoldMultiplierPct,
  };
}

export function tierMultiplierPct(
  multipliers: HostTierMultipliers,
  tier: PlayerGamingTier,
): number {
  return multipliers[tier];
}

/** Apply percent multiplier to integer LZT/min; rounds to nearest LZT. */
export function applyTierMultiplierToLzt(
  baseLzt: number,
  multiplierPct: number,
): number {
  if (baseLzt === 0) return 0;
  return Math.max(0, Math.round((baseLzt * multiplierPct) / 100));
}

/** Apply percent multiplier to USD/min rate. */
export function applyTierMultiplierToUsd(
  baseUsd: number,
  multiplierPct: number,
): number {
  if (baseUsd === 0) return 0;
  return (baseUsd * multiplierPct) / 100;
}

export function isValidTierMultiplierPct(value: number): boolean {
  return (
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= TIER_MULTIPLIER_MIN_PCT &&
    value <= TIER_MULTIPLIER_MAX_PCT
  );
}

export const PLAYER_TIER_LABELS: Record<PlayerGamingTier, string> = {
  bronze: "Бронза",
  silver: "Серебро",
  gold: "Золото",
};
