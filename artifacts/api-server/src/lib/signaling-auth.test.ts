import { describe, expect, it, vi, beforeEach } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";
delete process.env.JWT_SECRET;

const BLOCK_SESSION = {
  id: "sess-block-1",
  status: "active",
  playerToken: "player-tok-block",
  devKeyId: null,
  isTest: false,
  blockMinutes: 10,
  blockReservedLzt: 800,
  claimedByPlayerId: "player-uuid-1",
  ratePerMinute: "0.4",
  paymentSource: "auto",
};

const EMPTY_WALLET = {
  id: "player-uuid-1",
  playerToken: "wallet-tok-1",
  withdrawableBalanceLzt: 0,
  internalBalanceLzt: 0,
};

const mockCountSessionMinutesUsed = vi.fn(async () => 0);

vi.mock("./sessionBilling", () => ({
  countSessionMinutesUsed: (...args: unknown[]) => mockCountSessionMinutesUsed(...args),
}));

const mockWhere = vi.fn();
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock("@workspace/db", () => ({
  db: { select: mockSelect },
  hostsTable: {},
  sessionsTable: {},
  playersTable: {},
}));

vi.mock("./redis", () => ({
  getRedis: () => null,
  getRedisSubscriber: () => null,
  isRedisAvailable: () => false,
}));

describe("signaling legacy player auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCountSessionMinutesUsed.mockResolvedValue(0);
    mockWhere.mockImplementation(async () => [BLOCK_SESSION]);
  });

  it("allows WS connect when prepaid block has remaining minutes and liquid balance is 0", async () => {
    vi.resetModules();
    const { authenticateSignalingForTest } = await import("./signaling");
    mockWhere
      .mockResolvedValueOnce([BLOCK_SESSION])
      .mockResolvedValueOnce([EMPTY_WALLET]);

    const url = new URL(
      "ws://localhost/api/signal?role=player&playerToken=player-tok-block&playerWalletToken=wallet-tok-1",
    );
    const result = await authenticateSignalingForTest(url);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.sessionId).toBe(BLOCK_SESSION.id);
    }
    expect(mockCountSessionMinutesUsed).toHaveBeenCalledWith(expect.anything(), BLOCK_SESSION.id);
  });

  it("rejects WS connect when block is exhausted and liquid balance is 0", async () => {
    vi.resetModules();
    const { authenticateSignalingForTest } = await import("./signaling");
    mockCountSessionMinutesUsed.mockResolvedValue(10);
    mockWhere
      .mockResolvedValueOnce([BLOCK_SESSION])
      .mockResolvedValueOnce([EMPTY_WALLET]);

    const url = new URL(
      "ws://localhost/api/signal?role=player&playerToken=player-tok-block&playerWalletToken=wallet-tok-1",
    );
    const result = await authenticateSignalingForTest(url);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("insufficient balance to start");
    }
  });
});
