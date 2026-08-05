import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { depositsTable } from "../src/schema/deposits.ts";

describe("depositsTable", () => {
  it("maps to deposits", () => {
    assert.equal(getTableName(depositsTable), "deposits");
  });

  it("exposes deposit columns", () => {
    const cols = getTableColumns(depositsTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "address",
      "commissionAmount",
      "creditedAt",
      "currency",
      "detectedAt",
      "grossAmount",
      "id",
      "netAmount",
      "network",
      "ownerId",
      "ownerType",
      "status",
      "txHash",
    ]);
  });

  it("requires owner, currency, network, address and txHash", () => {
    const cols = getTableColumns(depositsTable);
    assert.equal(cols.ownerType.notNull, true);
    assert.equal(cols.ownerId.notNull, true);
    assert.equal(cols.currency.notNull, true);
    assert.equal(cols.network.notNull, true);
    assert.equal(cols.address.notNull, true);
    assert.equal(cols.txHash.notNull, true);
    assert.equal(cols.grossAmount.notNull, true);
    assert.equal(cols.commissionAmount.notNull, true);
    assert.equal(cols.netAmount.notNull, true);
    assert.equal(cols.status.notNull, true);
    assert.equal(cols.detectedAt.notNull, true);
    assert.equal(cols.creditedAt.notNull, false);
  });
});
