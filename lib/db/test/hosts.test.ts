import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { hostsTable } from "../src/schema/hosts.ts";

describe("hostsTable", () => {
  it("maps to hosts", () => {
    assert.equal(getTableName(hostsTable), "hosts");
  });

  it("exposes host columns", () => {
    const cols = getTableColumns(hostsTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "agentPubkey",
      "boundAppLabel",
      "boundAppPath",
      "boundUrl",
      "createdAt",
      "creditDebtLzt",
      "creditMaxLztPerPlayer",
      "creditMinutesPerNewPlayer",
      "creditReceivableLzt",
      "description",
      "displayName",
      "gameId",
      "gamesContributed",
      "hasDefault",
      "hostToken",
      "id",
      "interestSampleLzt",
      "internalBalanceLzt",
      "isAdmin",
      "isVds",
      "kycVerified",
      "lastSeenAt",
      "lastSubmissionNote",
      "lastSubmissionStatus",
      "launchPriceUsd",
      "lifetimeDepositUsdtCents",
      "maxDepositUsdtCents",
      "maxWithdrawalUsdtCents",
      "minutePriceUsd",
      "pcSpecs",
      "pendingInterestFractionLzt",
      "pingMs",
      "premiumUntil",
      "ratingAvg",
      "ratingCount",
      "scheduleAutoDisabledAt",
      "scheduleAutoDisabledReason",
      "scheduleJson",
      "scheduleMode",
      "streamKey",
      "streamPlatform",
      "streamUrl",
      "tags",
      "trustLevel",
      "withdrawableBalanceLzt",
    ]);
  });

  it("requires hostToken, displayName and economy defaults", () => {
    const cols = getTableColumns(hostsTable);
    assert.equal(cols.hostToken.notNull, true);
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
    assert.equal(cols.kycVerified.notNull, true);
    assert.equal(cols.hasDefault.notNull, true);
    assert.equal(cols.creditMinutesPerNewPlayer.notNull, true);
    assert.equal(cols.creditMaxLztPerPlayer.notNull, true);
    assert.equal(cols.scheduleMode.notNull, true);
    assert.equal(cols.scheduleJson.notNull, true);
    assert.equal(cols.trustLevel.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.lastSeenAt.notNull, true);
    assert.equal(cols.premiumUntil.notNull, false);
    assert.equal(cols.gameId.notNull, false);
    assert.equal(cols.agentPubkey.notNull, false);
    assert.equal(cols.pcSpecs.notNull, false);
    assert.equal(cols.pingMs.notNull, false);
    assert.equal(cols.ratingAvg.notNull, false);
    assert.equal(cols.lastSubmissionStatus.notNull, false);
    assert.equal(cols.scheduleAutoDisabledReason.notNull, false);
    assert.equal(cols.scheduleAutoDisabledAt.notNull, false);
  });
});
