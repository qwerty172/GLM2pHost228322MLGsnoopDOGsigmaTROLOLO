import { describe, expect, it, vi, beforeEach } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

type QueryResult = unknown[];

const queryQueue: QueryResult[] = [];

function queueResults(...batches: QueryResult[]) {
  queryQueue.push(...batches);
}

function nextResult(): QueryResult {
  return queryQueue.shift() ?? [];
}

function makeWhereChain() {
  const limitResult = vi.fn(async () => nextResult());
  return {
    limit: limitResult,
    then(
      resolve: (value: QueryResult) => void,
      reject?: (reason: unknown) => void,
    ) {
      return Promise.resolve(nextResult()).then(resolve, reject);
    },
  };
}

function chainSelect() {
  const innerJoinChain = {
    where: vi.fn(() => makeWhereChain()),
  };
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => makeWhereChain()),
      innerJoin: vi.fn(() => innerJoinChain),
    })),
  };
}

const mockInsertValues = vi.fn(async () => undefined);

const mockDb = {
  select: vi.fn(() => chainSelect()),
  insert: vi.fn(() => ({
    values: mockInsertValues,
  })),
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  joinCodesTable: { code: "code", sessionId: "sessionId", expiresAt: "expiresAt" },
  sessionsTable: {
    id: "id",
    playerToken: "playerToken",
    status: "status",
  },
}));

const mockGenerateJoinCode = vi.fn(() => "NEWCODE1");

vi.mock("./tokens", () => ({
  generateJoinCode: () => mockGenerateJoinCode(),
}));

const {
  JOIN_CODE_TTL_MS,
  ensureJoinCodeForSession,
  exchangeJoinCode,
  ensureJoinCodeForPlayerToken,
} = await import("./joinCodes");

describe("joinCodes", () => {
  beforeEach(() => {
    queryQueue.length = 0;
    vi.clearAllMocks();
    mockDb.select.mockImplementation(() => chainSelect());
    mockInsertValues.mockResolvedValue(undefined);
    mockGenerateJoinCode.mockReturnValue("NEWCODE1");
  });

  it("exposes 15-minute TTL constant", () => {
    expect(JOIN_CODE_TTL_MS).toBe(15 * 60 * 1000);
  });

  describe("ensureJoinCodeForSession", () => {
    it("returns an existing non-expired code", async () => {
      queueResults([{ code: "EXISTING" }]);
      await expect(ensureJoinCodeForSession("session-1")).resolves.toBe("EXISTING");
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("mints a new code when none exists", async () => {
      queueResults([]);
      await expect(ensureJoinCodeForSession("session-2")).resolves.toBe("NEWCODE1");
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "NEWCODE1",
          sessionId: "session-2",
          expiresAt: expect.any(Date),
        }),
      );
    });

    it("throws after repeated unique collisions", async () => {
      queueResults([]);
      mockInsertValues.mockRejectedValue(new Error("unique violation"));
      await expect(ensureJoinCodeForSession("session-3")).rejects.toThrow(
        "Failed to mint join code",
      );
      expect(mockGenerateJoinCode).toHaveBeenCalledTimes(5);
    });
  });

  describe("exchangeJoinCode", () => {
    it("returns null when code is unknown", async () => {
      queueResults([]);
      await expect(exchangeJoinCode("abc123")).resolves.toBeNull();
    });

    it("returns null when code is expired", async () => {
      queueResults([
        {
          sessionId: "s1",
          expiresAt: new Date(Date.now() - 60_000),
          playerToken: "tok",
          status: "active",
        },
      ]);
      await expect(exchangeJoinCode("abc123")).resolves.toBeNull();
    });

    it("returns null when session has ended", async () => {
      queueResults([
        {
          sessionId: "s1",
          expiresAt: new Date(Date.now() + 60_000),
          playerToken: "tok",
          status: "ended",
        },
      ]);
      await expect(exchangeJoinCode("abc123")).resolves.toBeNull();
    });

    it("returns playerToken and sessionId for a valid code", async () => {
      queueResults([
        {
          sessionId: "s-active",
          expiresAt: new Date(Date.now() + 60_000),
          playerToken: "player-tok",
          status: "active",
        },
      ]);
      await expect(exchangeJoinCode("abc123")).resolves.toEqual({
        playerToken: "player-tok",
        sessionId: "s-active",
      });
    });
  });

  describe("ensureJoinCodeForPlayerToken", () => {
    it("returns null when session is missing", async () => {
      queueResults([]);
      await expect(ensureJoinCodeForPlayerToken("missing-tok")).resolves.toBeNull();
    });

    it("returns null when session has ended", async () => {
      queueResults([{ id: "s-ended", status: "ended" }]);
      await expect(ensureJoinCodeForPlayerToken("ended-tok")).resolves.toBeNull();
    });

    it("mints a join code for an active session", async () => {
      queueResults([{ id: "s-live", status: "active" }], []);
      await expect(ensureJoinCodeForPlayerToken("live-tok")).resolves.toBe("NEWCODE1");
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
