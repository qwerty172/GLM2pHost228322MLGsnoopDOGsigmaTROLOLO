import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { withdrawalsTable } from "../src/schema/withdrawals.ts";

describe("withdrawalsTable", () => {
  it("maps to withdrawals", () => {
    assert.equal(getTableName(withdrawalsTable), "withdrawals");
  });

  it("exposes withdrawal columns", () => {
    const cols = getTableColumns(withdrawalsTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "address",
      "amount",
      "completedAt",
      "currency",
      "id",
      "ownerId",
      "ownerType",
      "requestedAt",
      "status",
    ]);
  });

  it("requires owner, currency, address and amount", () => {
    const cols = getTableColumns(withdrawalsTable);
    assert.equal(cols.ownerType.notNull, true);
    assert.equal(cols.ownerId.notNull, true);
    assert.equal(cols.currency.notNull, true);
    assert.equal(cols.address.notNull, true);
    assert.equal(cols.amount.notNull, true);
    assert.equal(cols.status.notNull, true);
    assert.equal(cols.requestedAt.notNull, true);
    assert.equal(cols.completedAt.notNull, false);
  });
});
