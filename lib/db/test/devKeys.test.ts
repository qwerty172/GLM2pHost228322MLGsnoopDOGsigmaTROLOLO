import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { devKeysTable } from "../src/schema/devKeys.ts";

describe("devKeysTable", () => {
  it("maps to dev_keys", () => {
    assert.equal(getTableName(devKeysTable), "dev_keys");
  });

  it("exposes dev key columns", () => {
    const cols = getTableColumns(devKeysTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "apiKey",
      "createdAt",
      "creditDebtLzt",
      "creditReceivableLzt",
      "displayName",
      "hostRulesJson",
      "id",
      "internalBalanceLzt",
      "lifetimeDepositUsdtCents",
      "maxDepositUsdtCents",
      "maxWithdrawalUsdtCents",
      "premiumUntil",
      "status",
      "withdrawableBalanceLzt",
    ]);
  });

  it("requires apiKey, balances and status", () => {
    const cols = getTableColumns(devKeysTable);
    assert.equal(cols.apiKey.notNull, true);
    assert.equal(cols.displayName.notNull, true);
    assert.equal(cols.internalBalanceLzt.notNull, true);
    assert.equal(cols.withdrawableBalanceLzt.notNull, true);
    assert.equal(cols.creditDebtLzt.notNull, true);
    assert.equal(cols.creditReceivableLzt.notNull, true);
    assert.equal(cols.lifetimeDepositUsdtCents.notNull, true);
    assert.equal(cols.maxDepositUsdtCents.notNull, true);
    assert.equal(cols.maxWithdrawalUsdtCents.notNull, true);
    assert.equal(cols.status.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.premiumUntil.notNull, false);
    assert.equal(cols.hostRulesJson.notNull, false);
  });
});
