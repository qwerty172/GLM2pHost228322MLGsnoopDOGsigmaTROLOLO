import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { sessionRatingsTable } from "../src/schema/sessionRatings.ts";

describe("sessionRatingsTable", () => {
  it("maps to session_ratings", () => {
    assert.equal(getTableName(sessionRatingsTable), "session_ratings");
  });

  it("exposes session rating columns", () => {
    const cols = getTableColumns(sessionRatingsTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "comment",
      "createdAt",
      "hostId",
      "id",
      "playerId",
      "score",
      "sessionId",
    ]);
  });

  it("requires sessionId, playerId, hostId, score and createdAt; comment defaults", () => {
    const cols = getTableColumns(sessionRatingsTable);
    assert.equal(cols.sessionId.notNull, true);
    assert.equal(cols.playerId.notNull, true);
    assert.equal(cols.hostId.notNull, true);
    assert.equal(cols.score.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.comment.notNull, true);
  });
});
