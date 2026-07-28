import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyTierMultiplierLzt,
  effectivePricePerMinuteLzt,
  playerDepositTierForLifetimeCents,
} from "../lib/playerDepositTier.js";

describe("playerDepositTier", () => {
  it("maps tiers", () => {
    assert.equal(playerDepositTierForLifetimeCents(0), "bronze");
    assert.equal(playerDepositTierForLifetimeCents(20_000), "gold");
  });

  it("applies multipliers", () => {
    const host = {
      tierBronzeMultiplierPct: 100,
      tierSilverMultiplierPct: 120,
      tierGoldMultiplierPct: 80,
    };
    assert.equal(effectivePricePerMinuteLzt(10, host, 20_000), 8);
    assert.equal(applyTierMultiplierLzt(100, 120), 120);
  });
});
