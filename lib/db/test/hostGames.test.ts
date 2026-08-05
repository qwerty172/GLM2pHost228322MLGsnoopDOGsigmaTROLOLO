import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { hostGamesTable } from "../src/schema/hostGames.ts";

describe("hostGamesTable", () => {
  it("maps to host_games", () => {
    assert.equal(getTableName(hostGamesTable), "host_games");
  });

  it("exposes host game columns", () => {
    const cols = getTableColumns(hostGamesTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "addedAt",
      "appPath",
      "boundUrl",
      "enabled",
      "gameId",
      "hostId",
      "id",
      "lastError",
      "launchArgs",
      "localAvailable",
      "pricePerMinuteLzt",
      "sortOrder",
    ]);
  });

  it("requires hostId, gameId and library defaults", () => {
    const cols = getTableColumns(hostGamesTable);
    assert.equal(cols.hostId.notNull, true);
    assert.equal(cols.gameId.notNull, true);
    assert.equal(cols.pricePerMinuteLzt.notNull, true);
    assert.equal(cols.appPath.notNull, true);
    assert.equal(cols.boundUrl.notNull, true);
    assert.equal(cols.launchArgs.notNull, true);
    assert.equal(cols.enabled.notNull, true);
    assert.equal(cols.sortOrder.notNull, true);
    assert.equal(cols.localAvailable.notNull, true);
    assert.equal(cols.lastError.notNull, true);
    assert.equal(cols.addedAt.notNull, true);
  });
});
