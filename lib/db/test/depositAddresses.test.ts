import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { depositAddressesTable } from "../src/schema/depositAddresses.ts";

function getDepositAddressIndexes() {
  const syms = Object.getOwnPropertySymbols(depositAddressesTable);
  const builderSym = syms.find((s) => String(s).includes("ExtraConfigBuilder"));
  const colsSym = syms.find((s) => String(s).includes("ExtraConfigColumns"));
  return depositAddressesTable[builderSym](depositAddressesTable[colsSym]);
}

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

  it("defaults minDeposit to zero", () => {
    const cols = getTableColumns(depositAddressesTable);
    assert.equal(cols.minDeposit.hasDefault, true);
    assert.equal(cols.minDeposit.default, "0");
  });

  it("defines owner/currency unique index and address index", () => {
    const extra = getDepositAddressIndexes();
    assert.equal(
      extra.ownerCurrencyUnique.config.name,
      "deposit_addresses_owner_currency_idx",
    );
    assert.equal(extra.addressIdx.config.name, "deposit_addresses_address_idx");
    assert.equal(extra.ownerCurrencyUnique.config.unique, true);
  });
});
