import { describe, expect, it } from "vitest";
import {
  applyTierMultiplierToLzt,
  applyTierMultiplierToUsd,
  playerGamingTierFromLifetimeCents,
  tierMultiplierPct,
} from "./playerPriceTier";

describe("playerGamingTierFromLifetimeCents", () => {
  it("classifies bronze/silver/gold by lifetime deposits", () => {
    expect(playerGamingTierFromLifetimeCents(0)).toBe("bronze");
    expect(playerGamingTierFromLifetimeCents(1_999)).toBe("bronze");
    expect(playerGamingTierFromLifetimeCents(2_000)).toBe("silver");
    expect(playerGamingTierFromLifetimeCents(19_999)).toBe("silver");
    expect(playerGamingTierFromLifetimeCents(20_000)).toBe("gold");
  });
});

describe("tier multipliers", () => {
  const multipliers = { bronze: 120, silver: 100, gold: 80 };

  it("picks the host multiplier for each tier", () => {
    expect(tierMultiplierPct(multipliers, "bronze")).toBe(120);
    expect(tierMultiplierPct(multipliers, "gold")).toBe(80);
  });

  it("applies multiplier to LZT and USD prices", () => {
    expect(applyTierMultiplierToLzt(10, 120)).toBe(12);
    expect(applyTierMultiplierToLzt(8, 80)).toBe(6);
    expect(applyTierMultiplierToUsd(0.04, 125)).toBeCloseTo(0.05);
  });

  it("keeps zero prices at zero", () => {
    expect(applyTierMultiplierToLzt(0, 150)).toBe(0);
    expect(applyTierMultiplierToUsd(0, 150)).toBe(0);
  });
});
