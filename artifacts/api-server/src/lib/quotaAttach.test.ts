import { describe, expect, it } from "vitest";
import { checkQuotaAttachment } from "./quotaAttach";
import type { Quota } from "@workspace/db";
import type { hostsTable } from "@workspace/db";

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
    royaltyBasis: null,
    royaltyValue: null,
    royaltySource: null,
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

function makeHost(overrides: Partial<typeof hostsTable.$inferSelect> = {}): typeof hostsTable.$inferSelect {
  return {
    id: "h1",
    hostToken: "tok",
    displayName: "Host",
    gameId: "g1",
    pcSpecs: null,
    ...overrides,
  } as typeof hostsTable.$inferSelect;
}

describe("checkQuotaAttachment", () => {
  it("rejects game mismatch", () => {
    const result = checkQuotaAttachment(makeQuota({ gameId: "other-game" }), makeHost(), "g1");
    expect(result).toEqual({ ok: false, error: "Quota is bound to a different game" });
  });

  it("allows attachment when host has no pcSpecs", () => {
    expect(checkQuotaAttachment(makeQuota(), makeHost(), "g1")).toEqual({ ok: true });
  });

  it("rejects below_min tier with Russian error", () => {
    const quota = makeQuota({ minRamGb: 32, minCpuCores: 16, minGpuVram: 12 });
    const host = makeHost({
      pcSpecs: { gpu: "GTX 1060 6 GB", ramGb: 8, cpuCores: 4, downloadMbps: 100, uploadMbps: 30 },
    });
    const result = checkQuotaAttachment(quota, host, "g1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("ниже минимальных требований");
  });
});
