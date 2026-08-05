import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { playersTable } from "../src/schema/players.ts";

describe("playersTable", () => {
  it("maps to players", () => {
    assert.equal(getTableName(playersTable), "players");
  });

  it("exposes player columns", () => {
    const cols = getTableColumns(playersTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "createdAt",
      "creditDebtLzt",
      "creditLimitLzt",
      "creditReceivableLzt",
      "displayName",
      "hasDefault",
      "id",
      "interestSampleLzt",
      "internalBalanceLzt",
      "isGuest",
      "kycVerified",
      "lastSeenAt",
      "lifetimeDepositUsdtCents",
      "maxDepositUsdtCents",
      "maxWithdrawalUsdtCents",
      "pendingInterestFractionLzt",
      "playerToken",
      "premiumUntil",
      "trustLevel",
      "withdrawableBalanceLzt",
    ]);
  });

  it("requires playerToken, displayName and economy defaults", () => {
    const cols = getTableColumns(playersTable);
    assert.equal(cols.playerToken.notNull, true);
    assert.equal(cols.displayName.notNull, true);
    assert.equal(cols.internalBalanceLzt.notNull, true);
    assert.equal(cols.withdrawableBalanceLzt.notNull, true);
    assert.equal(cols.creditDebtLzt.notNull, true);
    assert.equal(cols.creditReceivableLzt.notNull, true);
    assert.equal(cols.pendingInterestFractionLzt.notNull, true);
    assert.equal(cols.interestSampleLzt.notNull, true);
    assert.equal(cols.lifetimeDepositUsdtCents.notNull, true);
    assert.equal(cols.maxDepositUsdtCents.notNull, true);
    assert.equal(cols.maxWithdrawalUsdtCents.notNull, true);
    assert.equal(cols.creditLimitLzt.notNull, true);
    assert.equal(cols.kycVerified.notNull, true);
    assert.equal(cols.hasDefault.notNull, true);
    assert.equal(cols.isGuest.notNull, true);
    assert.equal(cols.trustLevel.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.lastSeenAt.notNull, true);
    assert.equal(cols.premiumUntil.notNull, false);
  });
});
