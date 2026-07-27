import { describe, it, expect, vi } from "vitest";

/**
 * Unit tests for block-renew idempotency helpers.
 * Full integration tests require a live Postgres instance.
 */

vi.mock("@workspace/db", () => ({
  ledgerTable: { id: "id", kind: "kind", refType: "refType", refId: "refId" },
  sessionsTable: { id: "id", blockMinutes: "blockMinutes", blockReservedLzt: "blockReservedLzt" },
}));

import {
  blockRenewRefId,
  hasBlockRenewLedger,
} from "./economy";

function mockTx(existingRenewLedger: boolean) {
  const limit = vi.fn().mockResolvedValue(existingRenewLedger ? [{ id: "ledger-1" }] : []);
  const select = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit }),
    }),
  });
  return { select } as unknown as Parameters<typeof hasBlockRenewLedger>[0];
}

describe("blockRenewRefId", () => {
  it("combines session id and idempotency key", () => {
    expect(blockRenewRefId("sess-1", "key-abc")).toBe("sess-1:key-abc");
  });
});

describe("hasBlockRenewLedger", () => {
  it("returns true when block_renew ledger row exists", async () => {
    const tx = mockTx(true);
    await expect(hasBlockRenewLedger(tx, "sess-1:key-abc")).resolves.toBe(true);
  });

  it("returns false when no ledger row", async () => {
    const tx = mockTx(false);
    await expect(hasBlockRenewLedger(tx, "sess-1:key-abc")).resolves.toBe(false);
  });
});
