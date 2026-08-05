import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Quota } from "@workspace/db";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

vi.mock("@workspace/db", () => {
  const tableStub = {
    id: "id",
    withdrawableBalanceLzt: "withdrawableBalanceLzt",
    escrowRemainingLzt: "escrowRemainingLzt",
    updatedAt: "updatedAt",
    totalRoyaltyLzt: "totalRoyaltyLzt",
    totalSponsorHostLzt: "totalSponsorHostLzt",
    totalSponsorPlayerLzt: "totalSponsorPlayerLzt",
    minutesBilled: "minutesBilled",
    quotaId: "quotaId",
    sessionId: "sessionId",
  };
  return {
    hostsTable: tableStub,
    playersTable: tableStub,
    quotasTable: tableStub,
    quotaSessionsTable: tableStub,
    billingEventsTable: tableStub,
  };
});

const queryQueue: unknown[][] = [];

function queueResults(...batches: unknown[][]) {
  queryQueue.push(...batches);
}

function nextResult(): unknown[] {
  return queryQueue.shift() ?? [];
}

function makeQueryable() {
  const result = {
    returning: vi.fn(function returning(this: typeof result) {
      return this;
    }),
    then(onFulfilled: (v: unknown) => unknown) {
      return Promise.resolve(nextResult()).then(onFulfilled);
    },
  };
  return result;
}

function mockTx() {
  return {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => makeQueryable()),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async () => undefined),
    })),
  };
}

const {
  computeQuotaEffect,
  isQuotaActiveNow,
  generateAccessCode,
  creditOwnerGreen,
  decrementEscrow,
  recordQuotaMovement,
  bumpQuotaSessionTotals,
} = await import("./quotaEngine");

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
  beforeEach(() => {
    queryQueue.length = 0;
    vi.restoreAllMocks();
  });

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

  describe("generateAccessCode", () => {
    it("returns an 8-character base32 code", () => {
      const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
      let i = 0;
      vi.spyOn(Math, "random").mockImplementation(() => (i++ % alphabet.length) / alphabet.length);
      const code = generateAccessCode();
      expect(code).toHaveLength(8);
      expect([...code].every((ch) => alphabet.includes(ch))).toBe(true);
    });
  });

  describe("creditOwnerGreen", () => {
    it("no-ops non-positive amounts", async () => {
      const tx = mockTx();
      await creditOwnerGreen(tx as never, "host", "h1", 0);
      expect(tx.update).not.toHaveBeenCalled();
    });

    it("credits a host withdrawable balance", async () => {
      const tx = mockTx();
      await creditOwnerGreen(tx as never, "host", "h1", 50);
      expect(tx.update).toHaveBeenCalled();
    });

    it("credits a player withdrawable balance", async () => {
      const tx = mockTx();
      await creditOwnerGreen(tx as never, "player", "p1", 25);
      expect(tx.update).toHaveBeenCalled();
    });
  });

  describe("decrementEscrow", () => {
    it("returns true for non-positive amounts without updating", async () => {
      const tx = mockTx();
      await expect(decrementEscrow(tx as never, "q1", 0)).resolves.toBe(true);
      expect(tx.update).not.toHaveBeenCalled();
    });

    it("returns true when the escrow row updates", async () => {
      queueResults([{ id: "q1" }]);
      const tx = mockTx();
      await expect(decrementEscrow(tx as never, "q1", 10)).resolves.toBe(true);
    });

    it("returns false when escrow is insufficient", async () => {
      queueResults([]);
      const tx = mockTx();
      await expect(decrementEscrow(tx as never, "q1", 10)).resolves.toBe(false);
    });
  });

  describe("recordQuotaMovement", () => {
    it("inserts a billing event for the quota movement", async () => {
      const tx = mockTx();
      await recordQuotaMovement(tx as never, {
        sessionId: "s1",
        hostId: "h1",
        playerId: "p1",
        quotaId: "q1",
        kind: "quota_royalty",
        amountLzt: 15,
        bucket: "green",
      });
      expect(tx.insert).toHaveBeenCalled();
      const values = tx.insert.mock.results[0].value.values;
      expect(values).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: "s1",
          hostId: "h1",
          playerId: "p1",
          quotaId: "q1",
          kind: "quota_royalty",
          hostCreditLzt: 15,
          bucket: "green",
        }),
      );
    });
  });

  describe("bumpQuotaSessionTotals", () => {
    it("updates per-session quota totals", async () => {
      const tx = mockTx();
      await bumpQuotaSessionTotals(tx as never, {
        quotaId: "q1",
        sessionId: "s1",
        royaltyLzt: 5,
        sponsorHostLzt: 3,
        sponsorPlayerLzt: 2,
      });
      expect(tx.update).toHaveBeenCalled();
    });
  });
});
