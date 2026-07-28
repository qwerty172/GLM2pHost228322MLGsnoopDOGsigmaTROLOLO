import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyTierMultiplierLzt,
  effectivePricePerMinuteLzt,
  playerDepositTierForLifetimeCents,
  PLAYER_TIER_GOLD_MIN_CENTS,
  PLAYER_TIER_SILVER_MIN_CENTS,
} from "../lib/playerDepositTier.js";

const defaultHost = {
  tierBronzeMultiplierPct: 100,
  tierSilverMultiplierPct: 120,
  tierGoldMultiplierPct: 80,
};

describe("playerDepositTier", () => {
  it("maps lifetime deposit to bronze/silver/gold", () => {
    assert.equal(playerDepositTierForLifetimeCents(0), "bronze");
    assert.equal(
      playerDepositTierForLifetimeCents(PLAYER_TIER_SILVER_MIN_CENTS - 1),
      "bronze",
    );
    assert.equal(
      playerDepositTierForLifetimeCents(PLAYER_TIER_SILVER_MIN_CENTS),
      "silver",
    );
    assert.equal(
      playerDepositTierForLifetimeCents(PLAYER_TIER_GOLD_MIN_CENTS - 1),
      "silver",
    );
    assert.equal(
      playerDepositTierForLifetimeCents(PLAYER_TIER_GOLD_MIN_CENTS),
      "gold",
    );
  });

  it("applies host tier multipliers to base LZT price", () => {
    assert.equal(applyTierMultiplierLzt(100, 100), 100);
    assert.equal(applyTierMultiplierLzt(100, 120), 120);
    assert.equal(applyTierMultiplierLzt(100, 80), 80);
    assert.equal(
      effectivePricePerMinuteLzt(10, defaultHost, PLAYER_TIER_GOLD_MIN_CENTS),
      8,
    );
    assert.equal(
      effectivePricePerMinuteLzt(10, defaultHost, PLAYER_TIER_SILVER_MIN_CENTS),
      12,
    );
    assert.equal(effectivePricePerMinuteLzt(10, defaultHost, 0), 10);
  });
});
