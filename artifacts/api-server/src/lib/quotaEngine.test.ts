import { describe, expect, it } from "vitest";
import { computeQuotaEffect, generateAccessCode, isQuotaActiveNow } from "./quotaEngine";
import type { Quota } from "@workspace/db";

function makeQuota(overrides: Partial<Quota> = {}): Quota {
  return {
    id: "q1",
    ownerType: "host",
    ownerId: "h1",
    kind: "royalty",
    status: "active",
    gameId: null,
    minGpuVram: null,
    minCpuCores: null,
    minRamGb: null,
    minDownloadMbps: null,
    minUploadMbps: null,
    recGpuVram: null,
    recCpuCores: null,
    recRamGb: null,
    recDownloadMbps: null,
    recUploadMbps: null,
    requiredTier: "minimum",
    royaltyBasis: "percent",
    royaltyValue: 10,
    royaltySource: "player",
    sponsorHostPerMinuteLzt: null,
    sponsorPlayerPerMinuteLzt: null,
    escrowRemainingLzt: null,
    minSessionMinutes: null,
    maxSessionMinutes: null,
    startAt: null,
    endAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Quota;
}

describe("computeQuotaEffect", () => {
  it("applies percent royalty capped at perMinuteLzt", () => {
    const effect = computeQuotaEffect(makeQuota(), 100, 5);
    expect(effect.royaltyLzt).toBe(10);
    expect(effect.sponsorHostLzt).toBe(0);
  });

  it("returns zero outside min session window", () => {
    const effect = computeQuotaEffect(makeQuota({ minSessionMinutes: 10 }), 100, 5);
    expect(effect.royaltyLzt).toBe(0);
  });

  it("pro-rates sponsor escrow on last partial tick", () => {
    const effect = computeQuotaEffect(
      makeQuota({
        kind: "sponsor",
        royaltyBasis: null,
        royaltyValue: null,
        sponsorHostPerMinuteLzt: 60,
        sponsorPlayerPerMinuteLzt: 60,
        escrowRemainingLzt: 80,
      }),
      100,
      1,
    );
    expect(effect.sponsorHostLzt).toBe(60);
    expect(effect.sponsorPlayerLzt).toBe(20);
  });
});

describe("generateAccessCode", () => {
  it("returns 8-char uppercase code", () => {
    const code = generateAccessCode();
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
  });
});

describe("isQuotaActiveNow", () => {
  const now = new Date("2026-06-01T12:00:00Z");

  it("checks status, dates, and sponsor escrow", () => {
    expect(isQuotaActiveNow(makeQuota(), now)).toBe(true);
    expect(isQuotaActiveNow(makeQuota({ status: "paused" }), now)).toBe(false);
    expect(
      isQuotaActiveNow(makeQuota({ startAt: new Date("2026-07-01T00:00:00Z") }), now),
    ).toBe(false);
    expect(
      isQuotaActiveNow(
        makeQuota({ kind: "sponsor", escrowRemainingLzt: 0 }),
        now,
      ),
    ).toBe(false);
  });
});
