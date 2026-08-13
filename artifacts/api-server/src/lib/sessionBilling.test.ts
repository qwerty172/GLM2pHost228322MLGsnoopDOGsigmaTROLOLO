import { describe, expect, it, vi, beforeEach } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

const mockSelectChain = {
  from: vi.fn(),
  where: vi.fn(),
  for: vi.fn(),
};

const mockUpdate = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => mockSelectChain),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mockUpdate,
      })),
    })),
  },
  billingEventsTable: { sessionId: "sessionId", kind: "kind", bucket: "bucket" },
  playersTable: {
    id: "id",
    withdrawableBalanceLzt: "withdrawableBalanceLzt",
    internalBalanceLzt: "internalBalanceLzt",
  },
  sessionsTable: { id: "id" },
}));

vi.mock("./logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./economy", () => ({
  writeLedger: vi.fn(async () => undefined),
}));

describe("sessionBilling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.for.mockResolvedValue([]);
    mockUpdate.mockResolvedValue(undefined);
  });

  it("exports billing helpers", async () => {
    const mod = await import("./sessionBilling");
    expect(typeof mod.countSessionMinutesUsed).toBe("function");
    expect(typeof mod.refundBlockRemainder).toBe("function");
  });

  it("refundBlockRemainder re-reads session under FOR UPDATE by id", async () => {
    const lockedSession = {
      id: "sess-1",
      blockMinutes: 25,
      blockReservedLzt: 2500,
      claimedByPlayerId: "player-1",
      paymentSource: "green",
    };
    mockSelectChain.for.mockResolvedValueOnce([lockedSession]);

    const { refundBlockRemainder } = await import("./sessionBilling");
    const tx = {
      select: vi.fn(() => mockSelectChain),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: mockUpdate,
        })),
      })),
    };

    await refundBlockRemainder(tx as never, "sess-1", 5);

    expect(tx.select).toHaveBeenCalled();
    expect(mockSelectChain.for).toHaveBeenCalledWith("update");
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("refundBlockRemainder no-ops when session row is missing", async () => {
    mockSelectChain.for.mockResolvedValueOnce([]);

    const { refundBlockRemainder } = await import("./sessionBilling");
    const tx = {
      select: vi.fn(() => mockSelectChain),
      update: vi.fn(),
    };

    await refundBlockRemainder(tx as never, "missing", 0);

    expect(tx.update).not.toHaveBeenCalled();
  });
});
