import { describe, it, expect, vi, beforeEach } from "vitest";

const mockWriteLedger = vi.fn();
const mockUpdate = vi.fn();

vi.mock("./logger", () => ({ logger: { info: vi.fn() } }));
vi.mock("./economy", () => ({
  writeLedger: (...args: unknown[]) => mockWriteLedger(...args),
}));

vi.mock("@workspace/db", () => ({
  playersTable: {
    id: "id",
    withdrawableBalanceLzt: "withdrawableBalanceLzt",
    internalBalanceLzt: "internalBalanceLzt",
  },
  billingEventsTable: {
    sessionId: "sessionId",
    kind: "kind",
    bucket: "bucket",
  },
  sessionsTable: {},
}));

import { refundBlockRemainder } from "./sessionBilling";

function mockTx() {
  const returning = vi.fn().mockResolvedValue(undefined);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  const from = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ n: 0 }]) });
  const select = vi.fn().mockReturnValue({ from });
  return { select, update } as unknown as Parameters<typeof refundBlockRemainder>[0];
}

describe("refundBlockRemainder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refunds the full block reserve when zero minutes were billed (pending session)", async () => {
    const tx = mockTx();
    const session = {
      id: "sess-1",
      blockMinutes: 15,
      blockReservedLzt: 3000,
      claimedByPlayerId: "player-1",
      paymentSource: "green",
    } as Parameters<typeof refundBlockRemainder>[1];

    await refundBlockRemainder(tx, session, 0);

    expect(mockWriteLedger).toHaveBeenCalledOnce();
    const ledgerRows = mockWriteLedger.mock.calls[0]![1] as Array<{
      kind: string;
      ownerId: string;
      deltaLzt: number;
    }>;
    expect(ledgerRows[0]).toMatchObject({
      kind: "block_refund",
      ownerId: "player-1",
      deltaLzt: 3000,
    });
  });
});
