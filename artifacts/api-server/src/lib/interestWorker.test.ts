import { describe, it, expect, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  ledgerTable: {
    id: "id",
    kind: "kind",
    ownerType: "ownerType",
    ownerId: "ownerId",
    refType: "refType",
    refId: "refId",
  },
}));

import { interestCycleKey, hasInterestPayoutForCycle } from "./economy";

describe("interestCycleKey", () => {
  it("formats UTC date as YYYY-MM-DD", () => {
    const now = new Date("2026-08-03T00:00:00.000Z");
    expect(interestCycleKey(now)).toBe("2026-08-03");
  });
});

describe("hasInterestPayoutForCycle", () => {
  it("returns true when ledger row exists for cycle", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: "x" }]);
    const tx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit }),
        }),
      }),
    } as unknown as Parameters<typeof hasInterestPayoutForCycle>[0];

    await expect(
      hasInterestPayoutForCycle(tx, "player", "player-1", "2026-08-03"),
    ).resolves.toBe(true);
  });

  it("returns false when no ledger row", async () => {
    const limit = vi.fn().mockResolvedValue([]);
    const tx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit }),
        }),
      }),
    } as unknown as Parameters<typeof hasInterestPayoutForCycle>[0];

    await expect(
      hasInterestPayoutForCycle(tx, "host", "host-1", "2026-08-03"),
    ).resolves.toBe(false);
  });
});
