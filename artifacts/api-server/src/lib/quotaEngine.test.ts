import { describe, expect, it } from "vitest";
import { computeQuotaEffect, generateAccessCode, isQuotaActiveNow } from "./quotaEngine";
import type { Quota } from "@workspace/db";

function baseQuota(overrides: Partial<Quota> = {}): Quota {
  return {
    id: "q1",
    kind: "royalty",
    status: "active",
    royaltyBasis: "percent",
    royaltyValue: 10,
    escrowRemainingLzt: 0,
    minSessionMinutes: null,
    maxSessionMinutes: null,
    startAt: null,
    endAt: null,
    sponsorHostPerMinuteLzt: null,
    sponsorPlayerPerMinuteLzt: null,
    ...overrides,
  } as Quota;
}

describe("quotaEngine", () => {
  it("computeQuotaEffect applies percent royalty", () => {
    const effect = computeQuotaEffect(baseQuota(), 100, 5);
    expect(effect.royaltyLzt).toBe(10);
  });

  it("generateAccessCode returns 8 chars", () => {
    expect(generateAccessCode()).toMatch(/^[A-Z2-9]{8}$/);
  });

  it("isQuotaActiveNow checks status and escrow", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(isQuotaActiveNow(baseQuota(), now)).toBe(true);
    expect(isQuotaActiveNow(baseQuota({ status: "paused" }), now)).toBe(false);
    expect(isQuotaActiveNow(baseQuota({ kind: "sponsor", escrowRemainingLzt: 0 }), now)).toBe(false);
  });
});
