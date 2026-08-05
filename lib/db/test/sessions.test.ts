import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { sessionsTable } from "../src/schema/sessions.ts";

describe("sessionsTable", () => {
  it("maps to sessions", () => {
    assert.equal(getTableName(sessionsTable), "sessions");
  });

  it("exposes session columns", () => {
    const cols = getTableColumns(sessionsTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "appName",
      "avgLossPct",
      "avgRttMs",
      "bitrateKbps",
      "blockMinutes",
      "blockReservedLzt",
      "claimedByPlayerId",
      "createdAt",
      "devKeyId",
      "endReason",
      "endedAt",
      "gameId",
      "hostId",
      "id",
      "inviteCode",
      "inviteExpiresAt",
      "isTest",
      "lastBilledAt",
      "paymentSource",
      "playerToken",
      "qualityScore",
      "quotaId",
      "ratePerMinute",
      "resolution",
      "startedAt",
      "status",
    ]);
  });

  it("requires host, game, playerToken, appName and billing defaults", () => {
    const cols = getTableColumns(sessionsTable);
    assert.equal(cols.hostId.notNull, true);
    assert.equal(cols.gameId.notNull, true);
    assert.equal(cols.playerToken.notNull, true);
    assert.equal(cols.appName.notNull, true);
    assert.equal(cols.status.notNull, true);
    assert.equal(cols.resolution.notNull, true);
    assert.equal(cols.bitrateKbps.notNull, true);
    assert.equal(cols.ratePerMinute.notNull, true);
    assert.equal(cols.paymentSource.notNull, true);
    assert.equal(cols.isTest.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.inviteCode.notNull, false);
    assert.equal(cols.inviteExpiresAt.notNull, false);
    assert.equal(cols.claimedByPlayerId.notNull, false);
    assert.equal(cols.devKeyId.notNull, false);
    assert.equal(cols.quotaId.notNull, false);
    assert.equal(cols.blockMinutes.notNull, false);
    assert.equal(cols.blockReservedLzt.notNull, false);
    assert.equal(cols.startedAt.notNull, false);
    assert.equal(cols.endedAt.notNull, false);
    assert.equal(cols.lastBilledAt.notNull, false);
    assert.equal(cols.endReason.notNull, false);
    assert.equal(cols.qualityScore.notNull, false);
    assert.equal(cols.avgRttMs.notNull, false);
    assert.equal(cols.avgLossPct.notNull, false);
  });
});
