import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { gameSubmissionsTable } from "../src/schema/gameSubmissions.ts";

describe("gameSubmissionsTable", () => {
  it("maps to game_submissions", () => {
    assert.equal(getTableName(gameSubmissionsTable), "game_submissions");
  });

  it("exposes submission columns", () => {
    const cols = getTableColumns(gameSubmissionsTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "approvedGameId",
      "category",
      "coverImageUrl",
      "createdAt",
      "defaultBrowserUrl",
      "description",
      "genres",
      "hostId",
      "id",
      "kind",
      "pendingHostConfig",
      "rejectionReason",
      "reviewedAt",
      "reviewerId",
      "slug",
      "status",
      "steamAppId",
      "title",
    ]);
  });

  it("requires hostId, status and title", () => {
    const cols = getTableColumns(gameSubmissionsTable);
    assert.equal(cols.hostId.notNull, true);
    assert.equal(cols.status.notNull, true);
    assert.equal(cols.title.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.reviewerId.notNull, false);
    assert.equal(cols.reviewedAt.notNull, false);
    assert.equal(cols.rejectionReason.notNull, false);
    assert.equal(cols.approvedGameId.notNull, false);
    assert.equal(cols.steamAppId.notNull, false);
    assert.equal(cols.pendingHostConfig.notNull, false);
  });
});
