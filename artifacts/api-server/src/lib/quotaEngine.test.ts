import { describe, expect, it } from "vitest";
import {
  computeQuotaEffect,
  generateAccessCode,
  isQuotaActiveNow,
} from "./quotaEngine";
import type { Quota } from "@workspace/db";

const baseQuota = (overrides: Partial<Quota> = {}): Quota =>
  ({
    id: "q1",
    status: "active",
    kind: "royalty",
    royaltyBasis: "percent",
    royaltyValue: 10,
    escrowRemainingLzt: 1000,
    minSessionMinutes: null,
    maxSessionMinutes: null,
    startAt: null,
    endAt: null,
    ...overrides,
  }) as Quota;

describe("quotaEngine", () => {
  it("computeQuotaEffect applies percent royalty", () => {
    const effect = computeQuotaEffect(baseQuota(), 100, 5);
    expect(effect.royaltyLzt).toBe(10);
    expect(effect.sponsorHostLzt).toBe(0);
  });

  it("generateAccessCode returns 8 chars", () => {
    expect(generateAccessCode().length).toBe(8);
  });

  it("isQuotaActiveNow checks status and escrow", () => {
    const now = new Date("2026-01-15T12:00:00Z");
    expect(isQuotaActiveNow(baseQuota(), now)).toBe(true);
    expect(isQuotaActiveNow(baseQuota({ status: "paused" }), now)).toBe(false);
    expect(
      isQuotaActiveNow(baseQuota({ kind: "sponsor", escrowRemainingLzt: 0 }), now),
    ).toBe(false);
  });
});
