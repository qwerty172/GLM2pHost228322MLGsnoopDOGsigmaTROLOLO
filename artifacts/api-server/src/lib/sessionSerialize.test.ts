import { describe, expect, it, vi, beforeEach } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:5432/test";

const { mockWhere, mockFrom, mockSelect } = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  return { mockWhere, mockFrom, mockSelect };
});

vi.mock("@workspace/db", () => ({
  db: { select: mockSelect },
  billingEventsTable: { sessionId: "sessionId", kind: "kind", bucket: "bucket" },
  sessionsTable: {},
}));

const { baseSerialize, enrichSession, enrichSessionBatch } = await import("./sessionSerialize");

type SessionRow = Parameters<typeof baseSerialize>[0];

function baseSession(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: "s1",
    ratePerMinute: "1.50",
    blockMinutes: null,
    ...overrides,
  } as SessionRow;
}

describe("sessionSerialize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWhere.mockResolvedValue([{ n: 0 }]);
  });

  it("coerces ratePerMinute to number", () => {
    expect(baseSerialize(baseSession()).ratePerMinute).toBe(1.5);
  });

  describe("enrichSession", () => {
    it("keeps blockMinsRemaining null when blockMinutes is unset", async () => {
      const result = await enrichSession(baseSession());
      expect(result.blockMinsRemaining).toBeNull();
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("computes remaining block minutes from billing ticks", async () => {
      mockWhere.mockResolvedValueOnce([{ n: 3 }]);
      const result = await enrichSession(baseSession({ blockMinutes: 10 }));
      expect(result.blockMinsRemaining).toBe(7);
      expect(result.ratePerMinute).toBe(1.5);
      expect(mockSelect).toHaveBeenCalled();
    });

    it("never returns negative remaining minutes", async () => {
      mockWhere.mockResolvedValueOnce([{ n: 12 }]);
      const result = await enrichSession(baseSession({ blockMinutes: 10 }));
      expect(result.blockMinsRemaining).toBe(0);
    });
  });

  describe("enrichSessionBatch", () => {
    it("enriches each session in parallel", async () => {
      mockWhere.mockResolvedValue([{ n: 2 }]);
      const sessions = [
        baseSession({ id: "s1", blockMinutes: 5 }),
        baseSession({ id: "s2", blockMinutes: null }),
      ];
      const results = await enrichSessionBatch(sessions);
      expect(results).toHaveLength(2);
      expect(results[0].blockMinsRemaining).toBe(3);
      expect(results[1].blockMinsRemaining).toBeNull();
    });
  });
});
