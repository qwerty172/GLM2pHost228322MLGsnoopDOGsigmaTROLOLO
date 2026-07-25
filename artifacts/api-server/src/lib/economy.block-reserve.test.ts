import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for block-reserve idempotency helpers.
 * Full integration tests require a live Postgres instance.
 */

vi.mock("@workspace/db", () => ({
  ledgerTable: { id: "id", kind: "kind", refType: "refType", refId: "refId" },
}));

import { hasBlockReserveLedger, debitBlockReserve } from "./economy";

function mockTx(existingLedger: boolean) {
  const limit = vi.fn().mockResolvedValue(existingLedger ? [{ id: "x" }] : []);
  const select = vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit }) }) });
  return { select } as unknown as Parameters<typeof hasBlockReserveLedger>[0];
}

describe("hasBlockReserveLedger", () => {
  it("returns true when block_reserve ledger row exists", async () => {
    const tx = mockTx(true);
    await expect(hasBlockReserveLedger(tx, "session-1")).resolves.toBe(true);
  });

  it("returns false when no ledger row", async () => {
    const tx = mockTx(false);
    await expect(hasBlockReserveLedger(tx, "session-1")).resolves.toBe(false);
  });
});

describe("debitBlockReserve idempotency", () => {
  it("skips debit when ledger already has block_reserve", async () => {
    const tx = mockTx(true);
    const result = await debitBlockReserve(tx, {
      playerId: "player-1",
      sessionId: "session-1",
      amountLzt: 400,
      bucket: "cash",
    });
    expect(result).toEqual({ ok: true });
  });
});
