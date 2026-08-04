import { describe, expect, it } from "vitest";
import type { Quota } from "@workspace/db";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

const { computeQuotaEffect, isQuotaActiveNow, buildQuotaEscrowBillingEvent } =
  await import("./quotaEngine");

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

  it("builds escrow billing rows without invalid session/host FKs", () => {
    expect(
      buildQuotaEscrowBillingEvent({
        ownerType: "player",
        ownerId: "player-1",
        quotaId: "quota-1",
        kind: "quota_escrow_lock",
        amountLzt: 500,
      }),
    ).toEqual({
      sessionId: null,
      hostId: null,
      playerId: "player-1",
      minutes: 0,
      bucket: "green",
      playerDebitLzt: 500,
      hostCreditLzt: -500,
      kind: "quota_escrow_lock",
      quotaId: "quota-1",
    });

    expect(
      buildQuotaEscrowBillingEvent({
        ownerType: "host",
        ownerId: "host-1",
        quotaId: "quota-2",
        kind: "quota_escrow_refund",
        amountLzt: 200,
      }),
    ).toEqual({
      sessionId: null,
      hostId: "host-1",
      playerId: null,
      minutes: 0,
      bucket: "green",
      playerDebitLzt: 0,
      hostCreditLzt: 200,
      kind: "quota_escrow_refund",
      quotaId: "quota-2",
    });
  });
});
