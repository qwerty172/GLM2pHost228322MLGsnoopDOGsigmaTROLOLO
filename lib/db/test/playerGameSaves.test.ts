import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { playerGameSavesTable } from "../src/schema/playerGameSaves.ts";

describe("playerGameSavesTable", () => {
  it("maps to player_game_saves", () => {
    assert.equal(getTableName(playerGameSavesTable), "player_game_saves");
  });

  it("exposes player game save columns", () => {
    const cols = getTableColumns(playerGameSavesTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "contentHash",
      "gameId",
      "id",
      "objectPath",
      "playerId",
      "sizeBytes",
      "storageKey",
      "updatedAt",
      "version",
    ]);
  });

  it("requires playerId, gameId and save metadata defaults", () => {
    const cols = getTableColumns(playerGameSavesTable);
    assert.equal(cols.playerId.notNull, true);
    assert.equal(cols.gameId.notNull, true);
    assert.equal(cols.objectPath.notNull, true);
    assert.equal(cols.storageKey.notNull, true);
    assert.equal(cols.version.notNull, true);
    assert.equal(cols.sizeBytes.notNull, true);
    assert.equal(cols.contentHash.notNull, true);
    assert.equal(cols.updatedAt.notNull, true);
  });
});
