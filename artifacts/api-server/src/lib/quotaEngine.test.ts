import { describe, expect, it } from "vitest";
import { resolveQuotaTickAmounts } from "./quotaEngine";
import type { Quota } from "@workspace/db";

function baseQuota(overrides: Partial<Quota> = {}): Quota {
  return {
    id: "q1",
    ownerType: "host",
    ownerId: "owner1",
    kind: "royalty",
    status: "active",
    royaltySource: "player",
    royaltyBasis: "percent",
    royaltyValue: 10,
    escrowRemainingLzt: 0,
    sponsorHostPerMinuteLzt: 0,
    sponsorPlayerPerMinuteLzt: 0,
    minSessionMinutes: null,
    maxSessionMinutes: null,
    startAt: null,
    endAt: null,
    devKeyId: null,
    accessCode: null,
    gameId: null,
    hostTier: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Quota;
}

describe("resolveQuotaTickAmounts", () => {
  it("adds player-source royalty to payer debit", () => {
    const quota = baseQuota({ royaltySource: "player", royaltyValue: 10 });
    const { payerDebitLzt, hostNetLzt, effect } = resolveQuotaTickAmounts(
      100,
      quota,
      1,
    );
    expect(effect.royaltyLzt).toBe(10);
    expect(payerDebitLzt).toBe(110);
    expect(hostNetLzt).toBe(100);
  });

  it("reduces host net for host_share royalty", () => {
    const quota = baseQuota({
      royaltySource: "host_share",
      royaltyValue: 25,
    });
    const { payerDebitLzt, hostNetLzt } = resolveQuotaTickAmounts(
      100,
      quota,
      1,
    );
    expect(payerDebitLzt).toBe(100);
    expect(hostNetLzt).toBe(75);
  });

  it("returns base amounts when quota is null", () => {
    const { payerDebitLzt, hostNetLzt, quotaActive } = resolveQuotaTickAmounts(
      50,
      null,
      1,
    );
    expect(quotaActive).toBe(false);
    expect(payerDebitLzt).toBe(50);
    expect(hostNetLzt).toBe(50);
  });
});
