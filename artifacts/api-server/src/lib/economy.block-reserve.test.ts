import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for block-reserve idempotency helpers.
 * Full integration tests require a live Postgres instance.
 */

vi.mock("@workspace/db", () => ({
  ledgerTable: { id: "id", kind: "kind", refType: "refType", refId: "refId" },
}));

import { hasBlockReserveLedger, debitBlockReserve, hasBlockRenewLedger, debitBlockRenew } from "./economy";

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

describe("hasBlockRenewLedger", () => {
  it("returns true when renew ledger row exists", async () => {
    const tx = mockTx(true);
    await expect(
      hasBlockRenewLedger(tx, "session-1", "renew-key-1"),
    ).resolves.toBe(true);
  });
});

describe("debitBlockRenew idempotency", () => {
  it("skips debit when renew key already processed", async () => {
    const tx = mockTx(true);
    const result = await debitBlockRenew(tx, {
      playerId: "player-1",
      sessionId: "session-1",
      amountLzt: 120,
      bucket: "cash",
      idempotencyKey: "renew-key-1",
      note: "block renew: +15 мин",
    });
    expect(result).toEqual({ ok: true, alreadyProcessed: true });
  });
});
