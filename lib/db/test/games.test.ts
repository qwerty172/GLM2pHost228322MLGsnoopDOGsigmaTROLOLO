import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getTableColumns, getTableName } from "drizzle-orm";
import { gamesTable } from "../src/schema/games.ts";

describe("gamesTable", () => {
  it("maps to games", () => {
    assert.equal(getTableName(gamesTable), "games");
  });

  it("exposes game columns", () => {
    const cols = getTableColumns(gamesTable);
    assert.deepEqual(Object.keys(cols).sort(), [
      "browserHostUrl",
      "category",
      "coverImageUrl",
      "createdAt",
      "description",
      "genre",
      "genres",
      "hasMods",
      "hasQuests",
      "hostSpectatesPlayer",
      "id",
      "isHidden",
      "isMultiplayer",
      "recSpecs",
      "saveManifest",
      "slug",
      "specsFetchedAt",
      "specsSource",
      "steamAppId",
      "title",
    ]);
  });

  it("requires slug, title and catalog defaults", () => {
    const cols = getTableColumns(gamesTable);
    assert.equal(cols.slug.notNull, true);
    assert.equal(cols.title.notNull, true);
    assert.equal(cols.coverImageUrl.notNull, true);
    assert.equal(cols.description.notNull, true);
    assert.equal(cols.genre.notNull, true);
    assert.equal(cols.category.notNull, true);
    assert.equal(cols.genres.notNull, true);
    assert.equal(cols.hasMods.notNull, true);
    assert.equal(cols.isMultiplayer.notNull, true);
    assert.equal(cols.hostSpectatesPlayer.notNull, true);
    assert.equal(cols.hasQuests.notNull, true);
    assert.equal(cols.browserHostUrl.notNull, true);
    assert.equal(cols.saveManifest.notNull, true);
    assert.equal(cols.isHidden.notNull, true);
    assert.equal(cols.createdAt.notNull, true);
    assert.equal(cols.steamAppId.notNull, false);
    assert.equal(cols.recSpecs.notNull, false);
    assert.equal(cols.specsSource.notNull, false);
    assert.equal(cols.specsFetchedAt.notNull, false);
  });
});
