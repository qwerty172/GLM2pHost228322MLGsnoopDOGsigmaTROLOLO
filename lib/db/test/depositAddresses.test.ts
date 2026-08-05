import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { depositAddressesTable } from "../src/schema/depositAddresses.ts";

describe("depositAddressesTable", () => {
  it("maps to deposit_addresses", () => {
    assert.equal(getTableName(depositAddressesTable), "deposit_addresses");
  });

  it("exposes deposit address columns", () => {
    const cols = getTableColumns(depositAddressesTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "address",
      "createdAt",
      "currency",
      "encryptedPrivateKey",
      "id",
      "label",
      "minDeposit",
      "network",
      "ownerId",
      "ownerType",
    ]);
  });

  it("requires owner, currency, address and network", () => {
    const cols = getTableColumns(depositAddressesTable);
    assert.equal(cols.ownerType.notNull, true);
    assert.equal(cols.ownerId.notNull, true);
    assert.equal(cols.currency.notNull, true);
    assert.equal(cols.label.notNull, true);
    assert.equal(cols.address.notNull, true);
    assert.equal(cols.network.notNull, true);
    assert.equal(cols.minDeposit.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.encryptedPrivateKey.notNull, false);
  });
});
