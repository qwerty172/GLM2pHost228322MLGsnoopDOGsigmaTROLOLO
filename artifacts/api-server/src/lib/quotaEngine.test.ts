import { describe, expect, it } from "vitest";
import type { Quota } from "@workspace/db";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

const { computeQuotaEffect, isQuotaActiveNow } = await import("./quotaEngine");

function baseQuota(overrides: Partial<Quota> = {}): Quota {
  return {
    id: "q1",
    ownerType: "player",
    ownerId: "p1",
    kind: "royalty",
    status: "active",
    royaltyBasis: "percent",
    royaltyValue: 10,
    minSessionMinutes: null,
    maxSessionMinutes: null,
    escrowRemainingLzt: 0,
    startAt: null,
    endAt: null,
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
    royaltySource: "player",
    sponsorHostPerMinuteLzt: null,
    sponsorPlayerPerMinuteLzt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Quota;
}

describe("quotaEngine", () => {
  it("computes royalty percent cut", () => {
    expect(computeQuotaEffect(baseQuota(), 100, 1)).toEqual({
      royaltyLzt: 10,
      sponsorHostLzt: 0,
      sponsorPlayerLzt: 0,
    });
  });

  it("returns inactive sponsor quota when escrow is empty", () => {
    const q = baseQuota({ kind: "sponsor", escrowRemainingLzt: 0 });
    expect(isQuotaActiveNow(q)).toBe(false);
  });
});
