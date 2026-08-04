import { describe, expect, it } from "vitest";
import {
  computeQuotaEffect,
  generateAccessCode,
  isQuotaActiveNow,
} from "./quotaEngine";

const baseQuota = {
  id: "q1",
  kind: "royalty" as const,
  status: "active" as const,
  royaltyBasis: "percent" as const,
  royaltyValue: 10,
  royaltySource: "player" as const,
  minSessionMinutes: null,
  maxSessionMinutes: null,
  escrowRemainingLzt: null,
  startAt: null,
  endAt: null,
  sponsorHostPerMinuteLzt: null,
  sponsorPlayerPerMinuteLzt: null,
};

describe("quotaEngine", () => {
  it("computeQuotaEffect applies percent royalty", () => {
    const eff = computeQuotaEffect(baseQuota, 100, 5);
    expect(eff.royaltyLzt).toBe(10);
  });

  it("generateAccessCode returns 8 chars", () => {
    expect(generateAccessCode().length).toBe(8);
  });

  it("isQuotaActiveNow checks status and dates", () => {
    expect(isQuotaActiveNow(baseQuota)).toBe(true);
    expect(isQuotaActiveNow({ ...baseQuota, status: "paused" })).toBe(false);
  });
});
